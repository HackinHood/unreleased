const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  forceUpdate:     () => ipcRenderer.invoke('force-update'),
  installUpdate:   () => ipcRenderer.invoke('install-update'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow:    () => ipcRenderer.invoke('close-window'),
  isMaximized:    () => ipcRenderer.invoke('is-maximized'),
  platform: process.platform,

  // Local filesystem
  browseLocal: (dirPath) => ipcRenderer.invoke('browse-local', dirPath),
  pickFolder:  ()        => ipcRenderer.invoke('pick-folder'),
  openPath:    (p)       => ipcRenderer.invoke('open-path', p),
  selectImageFile: ()    => ipcRenderer.invoke('select-image-file'),
  openDiscordLogin: (url) => ipcRenderer.invoke('open-discord-login', url),

  // App settings
  getAppSettings:  ()           => ipcRenderer.invoke('get-app-settings'),
  setAppSetting:   (key, value) => ipcRenderer.invoke('set-app-setting', key, value),

  // Library
  loadLibraryData:    ()              => ipcRenderer.invoke('load-library-data'),
  saveLibraryData:    (data)          => ipcRenderer.invoke('save-library-data', data),
  scanLibrary:        (folders)       => ipcRenderer.invoke('scan-library', folders),
  readAlbumArt:       (filePath)      => ipcRenderer.invoke('read-album-art', filePath),
  readTrackMetadata:  (filePath)      => ipcRenderer.invoke('read-track-metadata', filePath),
  writeTrackMetadata: (filePath, meta) => ipcRenderer.invoke('write-track-metadata', filePath, meta),

  // Local playlists
  loadLocalPlaylists: ()          => ipcRenderer.invoke('load-local-playlists'),
  saveLocalPlaylists: (playlists) => ipcRenderer.invoke('save-local-playlists', playlists),

  // Update status events (returns cleanup fn)
  onUpdateStatus: (cb) => {
    const fn = (_, d) => cb(d)
    ipcRenderer.on('update-status', fn)
    return () => ipcRenderer.removeListener('update-status', fn)
  },

  // Download events (returns cleanup fn)
  onDownloadStarted: (cb) => {
    const fn = (_, d) => cb(d)
    ipcRenderer.on('download-started', fn)
    return () => ipcRenderer.removeListener('download-started', fn)
  },
  onDownloadProgress: (cb) => {
    const fn = (_, d) => cb(d)
    ipcRenderer.on('download-progress', fn)
    return () => ipcRenderer.removeListener('download-progress', fn)
  },
  onDownloadDone: (cb) => {
    const fn = (_, d) => cb(d)
    ipcRenderer.on('download-done', fn)
    return () => ipcRenderer.removeListener('download-done', fn)
  },
})
