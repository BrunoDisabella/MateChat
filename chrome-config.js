module.exports = { 
  chromePath: "/usr/bin/google-chrome", 
  puppeteerArgs: [
    "--no-sandbox", 
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-features=AudioServiceOutOfProcess",
    "--disable-web-security",
    "--aggressive-cache-discard",
    "--disable-cache",
    "--disable-application-cache",
    "--disable-offline-load-stale-cache",
    "--disk-cache-size=0",
    "--headless",
    "--hide-scrollbars",
    "--disable-bundled-ppapi-flash",
    "--mute-audio",
    "--disable-gl-drawing-for-tests"
  ],
  detected: "vie. 28/02/2025" 
}; 