package com.juicewrldapi.player;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app APK updates for the sideloaded Android build.
 *
 * This app isn't on the Play Store (unreleased-music content), so it gets no
 * store update channel — lib/androidUpdate.ts finds the newest `android-v*`
 * GitHub release and this plugin downloads and installs it without leaving
 * the app.
 *
 * Three things here are non-obvious and are why this is native rather than JS:
 *
 *  - Installing goes through {@link PackageInstaller}'s session API, not the
 *    old ACTION_VIEW intent. That intent is fire-and-forget: it hands the APK
 *    to another process and never reports back, so a stalled or silently
 *    failed install (Play Protect blocking it, not enough storage, a
 *    truncated download) is indistinguishable from one still in progress and
 *    the UI can only spin forever. A session commits with a status
 *    PendingIntent and tells us SUCCESS or FAILURE with a reason.
 *  - REQUEST_INSTALL_PACKAGES in the manifest only grants the *ability to
 *    ask*. On API 26+ the user must additionally allow "install unknown apps"
 *    for this app; canInstall()/openInstallSettings() let the UI check and
 *    route them there instead of committing a session that can only fail.
 *  - GitHub release URLs 302 to objects.githubusercontent.com. Redirects are
 *    followed manually because HttpURLConnection refuses to auto-follow one
 *    that changes protocol, and these can land on a different host/scheme.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private static final int MAX_REDIRECTS = 5;

    /** Broadcast the install session reports its status back on. */
    private static final String ACTION_INSTALL_STATUS =
            "com.juicewrldapi.player.INSTALL_STATUS";

    private BroadcastReceiver statusReceiver;

    @Override
    public void load() {
        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleStatus(intent);
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_INSTALL_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(statusReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (statusReceiver != null) {
            try { getContext().unregisterReceiver(statusReceiver); } catch (Exception ignored) {}
            statusReceiver = null;
        }
    }

    /** Whether the OS will let us launch a package install right now. */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", hasInstallPermission());
        call.resolve(ret);
    }

    private boolean hasInstallPermission() {
        // Below API 26 the manifest permission alone is sufficient; the
        // per-app "unknown sources" toggle didn't exist yet.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** Opens the per-app "install unknown apps" screen for this package. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { call.resolve(); return; }
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /**
     * Download `url`, stage it, and commit an install session.
     *
     * Runs off the caller's thread; emits `downloadProgress` ({percent,
     * bytes, total}) as it goes, then resolves once the session is committed.
     * The install itself finishes asynchronously in the system installer and
     * its outcome arrives separately as an `installStatus` event ({state,
     * message}) — see handleStatus.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("A url is required"); return; }

        if (!hasInstallPermission()) {
            call.reject("PERMISSION_REQUIRED");
            return;
        }

        new Thread(() -> {
            try {
                File apk = download(url, call);
                installSession(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Download failed" : e.getMessage(), e);
            }
        }).start();
    }

    private File download(String url, PluginCall call) throws Exception {
        // App-specific external dir: no storage permission needed, and it's
        // covered by the <external-files-path> entry in res/xml/file_paths.xml.
        File dir = new File(getContext().getExternalFilesDir(null), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create download directory");

        // One fixed filename, replaced each time — otherwise every check-and-
        // update cycle leaves another ~7 MB APK behind forever.
        File out = new File(dir, "update.apk");
        if (out.exists() && !out.delete()) throw new Exception("Could not clear previous download");

        HttpURLConnection conn = null;
        String current = url;
        try {
            for (int hop = 0; ; hop++) {
                conn = (HttpURLConnection) new URL(current).openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(30000);
                // The redirect chain crosses hosts (github.com -> objects.githubusercontent.com),
                // and Android's HttpURLConnection connection pool has a known issue where it hands
                // back a stale keep-alive socket after a cross-host hop, failing the body read
                // partway through with "unexpected end of stream". Forcing a fresh connection per
                // hop avoids the reuse entirely.
                conn.setRequestProperty("Connection", "close");
                conn.connect();
                int code = conn.getResponseCode();
                if (code == HttpURLConnection.HTTP_MOVED_PERM
                        || code == HttpURLConnection.HTTP_MOVED_TEMP
                        || code == HttpURLConnection.HTTP_SEE_OTHER
                        || code == 307 || code == 308) {
                    if (hop >= MAX_REDIRECTS) throw new Exception("Too many redirects");
                    String next = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (next == null) throw new Exception("Redirect without a Location header");
                    // Resolve against the current URL so a relative Location works.
                    current = new URL(new URL(current), next).toString();
                    continue;
                }
                if (code != HttpURLConnection.HTTP_OK) throw new Exception("Server returned " + code);
                break;
            }

            int total = conn.getContentLength();
            byte[] buf = new byte[16384];
            long done = 0;
            int lastPct = -1;

            try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
                int n;
                while ((n = in.read(buf)) != -1) {
                    fos.write(buf, 0, n);
                    done += n;
                    if (total > 0) {
                        int pct = (int) (done * 100 / total);
                        // Only on change — an event per 16 KB chunk would be
                        // hundreds of needless bridge crossings and re-renders.
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject p = new JSObject();
                            p.put("percent", pct);
                            p.put("bytes", done);
                            p.put("total", total);
                            notifyListeners("downloadProgress", p);
                        }
                    }
                }
            }

            // A connection that drops mid-body leaves a short but perfectly
            // readable file behind. Staging it anyway only moves the failure
            // into the installer, where it reads as a broken update rather
            // than a download worth retrying.
            if (total > 0 && done != total) {
                out.delete();
                throw new Exception("Download was incomplete (" + done + " of " + total
                        + " bytes) — check your connection and try again.");
            }
            return out;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Stage the APK into a PackageInstaller session and commit it.
     *
     * Unlike the ACTION_VIEW intent this replaced, the bytes are copied into
     * the session up front — so a corrupt or unreadable APK fails here, with a
     * reason — and commit() reports its outcome to ACTION_INSTALL_STATUS.
     */
    private void installSession(File apk) throws Exception {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();

        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());
        // Lets the installer fail fast on a device that's too full instead of
        // dying partway through the session write.
        params.setSize(apk.length());

        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream in = new FileInputStream(apk);
                 OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                session.fsync(out);
            }

            Intent intent = new Intent(ACTION_INSTALL_STATUS).setPackage(getContext().getPackageName());
            // MUTABLE: the system fills EXTRA_STATUS and friends into this intent.
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent status = PendingIntent.getBroadcast(getContext(), sessionId, intent, flags);
            session.commit(status.getIntentSender());
        } catch (Exception e) {
            // An abandoned session frees its staged copy; leaving it open would
            // hold the APK's worth of storage until the OS eventually reaps it.
            try { installer.abandonSession(sessionId); } catch (Exception ignored) {}
            throw e;
        }
    }

    /**
     * Relay a session status broadcast to the UI.
     *
     * STATUS_PENDING_USER_ACTION is the normal first hop: the system wants the
     * user to confirm and hands us the dialog to launch. Everything else is
     * terminal. SUCCESS is best-effort — a successful self-update kills this
     * process, so the UI usually never sees it; the states that matter are the
     * failures, which previously showed as an install that never finished.
     */
    private void handleStatus(Intent intent) {
        int code = intent.getIntExtra(PackageInstaller.EXTRA_STATUS,
                PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (code == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm == null) {
                emitStatus("failed", "Android did not return an install prompt.");
                return;
            }
            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(confirm);
            } else {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(confirm);
            }
            emitStatus("confirming", null);
            return;
        }

        switch (code) {
            case PackageInstaller.STATUS_SUCCESS:
                emitStatus("success", null);
                break;
            case PackageInstaller.STATUS_FAILURE_ABORTED:
                emitStatus("cancelled", "Install cancelled.");
                break;
            default:
                emitStatus("failed", describeFailure(code, message));
        }
    }

    private static String describeFailure(int code, String message) {
        String reason;
        switch (code) {
            case PackageInstaller.STATUS_FAILURE_BLOCKED:
                reason = "Android blocked the install — Play Protect or a device policy rejected it.";
                break;
            case PackageInstaller.STATUS_FAILURE_CONFLICT:
                reason = "This update conflicts with the installed app. Uninstall the app and install the APK manually.";
                break;
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE:
                reason = "This APK is not compatible with your device.";
                break;
            case PackageInstaller.STATUS_FAILURE_INVALID:
                reason = "The downloaded APK was rejected as invalid. Try the update again.";
                break;
            case PackageInstaller.STATUS_FAILURE_STORAGE:
                reason = "There is not enough storage to install the update.";
                break;
            default:
                reason = "The install failed.";
        }
        return message == null || message.isEmpty() ? reason : reason + " (" + message + ")";
    }

    private void emitStatus(String state, String message) {
        JSObject s = new JSObject();
        s.put("state", state);
        if (message != null) s.put("message", message);
        notifyListeners("installStatus", s);
    }
}
