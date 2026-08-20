package com.juicewrldapi.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

/**
 * The actual "keep the app alive and show real transport controls" half of
 * Android playback. Audio itself never touches this class — it plays inside
 * the WebView's own <audio> element, driven from Player.tsx — this Service
 * exists purely so the OS treats that playback as a real foreground media
 * session instead of background webview work it's free to kill:
 *
 *  - startForeground() with a MediaStyle notification, so Android gives this
 *    process foreground priority instead of killing it as an idle background
 *    app the moment the user switches away.
 *  - A MediaSessionCompat, so the notification/lock-screen/Bluetooth/wear
 *    transport controls exist at all and hardware media buttons have
 *    somewhere to go.
 *
 * Deliberately does NOT request its own AudioManager focus. Chromium already
 * requests audio focus automatically the moment the WebView's <audio>
 * element starts playing (org.chromium.content.browser.AudioFocusDelegate) —
 * a second AUDIOFOCUS_GAIN request from this Service, in the same process,
 * makes Android immediately hand that first holder an AUDIOFOCUS_LOSS, and
 * Chromium's delegate responds to that by pausing the <audio> element. Found
 * 2026-08-21: every play attempt request-stole focus from itself and got
 * paused ~100-300ms later, in an endless loop — "can't even play songs, they
 * just auto pause". Real external focus interruptions (calls, other apps)
 * are already handled correctly by Chromium's own delegate via the normal
 * <audio> pause/play events Player.tsx listens to; this class only needs to
 * keep the process foreground and drive the notification/lock-screen UI.
 *
 * JS (see lib/mediaControl.ts) drives all of this through MediaSessionPlugin
 * — it reports metadata/playback state and reacts to the Listener callbacks
 * below (play/pause/seek); this class makes no playback decisions of its
 * own; see MediaSessionPlugin for that split.
 */
public class PlaybackService extends Service {

    private static final String CHANNEL_ID = "playback";
    private static final int NOTIFICATION_ID = 1;

    /** Routes MediaSession callbacks back to JS. Set once by
     *  MediaSessionPlugin.load() — this app never runs more than one plugin
     *  instance, so a static slot (rather than a bind/messenger dance) is
     *  the simplest thing that works. */
    public interface Listener {
        void onPlay();
        void onPause();
        void onNext();
        void onPrevious();
        void onSeekTo(long positionMs);
    }

    private static Listener listener;
    public static void setListener(Listener l) { listener = l; }

    // volatile: getInstance() is read from the "CapacitorPlugins" HandlerThread
    // while onCreate() runs on the main thread, with no other synchronization
    // between them — without this, a reader can observe `instance` non-null
    // before this object's own field writes (mediaSession, notably) have
    // become visible, and NPE on a half-constructed service. Publishing
    // `instance` only at the end of onCreate() (below), after everything else
    // is set up, is the other half of the fix — a reader should never be able
    // to see this object before it's actually ready.
    private static volatile PlaybackService instance;
    @Nullable
    public static PlaybackService getInstance() { return instance; }

    // Applied in onCreate() if set before the service finished starting —
    // covers the race between MediaSessionPlugin.ensureStarted() and this
    // Service's onCreate() actually running. Cheap enough to just always set
    // these from the plugin rather than track whether they're "needed".
    public static String pendingTitle = "";
    public static String pendingArtist = "";
    public static String pendingAlbum = "";
    public static Bitmap pendingArtwork = null;
    public static long pendingDurationMs = 0L;
    public static boolean pendingPlaying = false;
    public static long pendingPositionMs = 0L;
    public static float pendingSpeed = 1f;

    private MediaSessionCompat mediaSession;

    private String title = "";
    private String artist = "";
    private String album = "";
    private Bitmap artwork;
    private long durationMs = 0L;
    private boolean isPlaying = false;
    private long positionMs = 0L;
    private float speed = 1f;

    @Override
    public void onCreate() {
        super.onCreate();

        mediaSession = new MediaSessionCompat(this, "UnreleasedPlayback");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { if (listener != null) listener.onPlay(); }
            @Override public void onPause() { if (listener != null) listener.onPause(); }
            @Override public void onStop() { if (listener != null) listener.onPause(); }
            @Override public void onSkipToNext() { if (listener != null) listener.onNext(); }
            @Override public void onSkipToPrevious() { if (listener != null) listener.onPrevious(); }
            @Override public void onSeekTo(long pos) { if (listener != null) listener.onSeekTo(pos); }
        });
        mediaSession.setActive(true);

        // Pick up whatever JS already reported before this onCreate() ran.
        title = pendingTitle; artist = pendingArtist; album = pendingAlbum;
        artwork = pendingArtwork; durationMs = pendingDurationMs;
        isPlaying = pendingPlaying; positionMs = pendingPositionMs; speed = pendingSpeed;
        applyMetadataToSession();
        applyStateToSession();

        createChannel();
        startForegroundCompat(buildNotification());

        // Published last, and deliberately not until everything above is
        // ready — see the field's comment.
        instance = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && mediaSession != null) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return START_STICKY;
    }

    @Override
    @Nullable
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); }
        if (instance == this) instance = null;
        super.onDestroy();
    }

    /** Called by MediaSessionPlugin whenever JS reports new track metadata. */
    public void update(String title, String artist, String album, Bitmap artwork, long durationMs) {
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.artwork = artwork;
        this.durationMs = durationMs;
        applyMetadataToSession();
        refreshNotification();
    }

    /** Called by MediaSessionPlugin whenever JS reports a play/pause/seek. */
    public void updatePlaybackState(boolean playing, long positionMs, float speed) {
        this.isPlaying = playing;
        this.positionMs = positionMs;
        this.speed = speed;
        applyStateToSession();
        refreshNotification();
    }

    private void applyMetadataToSession() {
        mediaSession.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
            .build());
    }

    private void applyStateToSession() {
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_STOP;
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        mediaSession.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, speed)
            .build());
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Playback controls");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }
    }

    private void refreshNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent playPausePI = MediaButtonReceiver.buildMediaButtonPendingIntent(
            this, isPlaying ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY
        );
        PendingIntent nextPI = MediaButtonReceiver.buildMediaButtonPendingIntent(
            this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT
        );
        PendingIntent prevPI = MediaButtonReceiver.buildMediaButtonPendingIntent(
            this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
        );
        PendingIntent stopPI = MediaButtonReceiver.buildMediaButtonPendingIntent(
            this, PlaybackStateCompat.ACTION_STOP
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title.isEmpty() ? getString(R.string.app_name) : title)
            .setContentText(artist)
            .setSubText(album.isEmpty() ? null : album)
            .setLargeIcon(artwork)
            .setContentIntent(contentIntent)
            .setDeleteIntent(stopPI)
            .setOnlyAlertOnce(true)
            // Dismissible by a swipe while paused (matches most media apps'
            // convention), pinned in place while actually playing.
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPI)
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                playPausePI
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextPI)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(true)
                .setCancelButtonIntent(stopPI));
        return builder.build();
    }
}
