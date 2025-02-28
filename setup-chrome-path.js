const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Posibles ubicaciones de Chrome en Windows
const possiblePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
];

function findChromePath() {
  // Primero intentamos las rutas comunes
  for (const chromePath of possiblePaths) {
    try {
      const expandedPath = chromePath.replace('%USERNAME%', process.env.USERNAME || 'User');
      if (fs.existsSync(expandedPath)) {
        return expandedPath;
      }
    } catch (err) {
      // Ignorar errores y seguir con la siguiente ruta
    }
  }

  // Si no podemos encontrar Chrome, intentamos usar el registro de Windows
  try {
    const regCommand = 'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve';
    const regResult = execSync(regCommand, { encoding: 'utf8' });
    const match = regResult.match(/REG_SZ\s+(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (err) {
    // Si el comando reg falla, continuamos con el siguiente método
  }

  // Si aún no encontramos Chrome, pedimos al usuario que ingrese la ruta
  console.log('No se pudo detectar automáticamente la ubicación de Chrome.');
  console.log('Por favor, ingresa la ruta completa a chrome.exe manualmente en el archivo chrome-config.js');
  
  return null;
}

function updateChromeConfig() {
  const chromePath = findChromePath();
  
  if (chromePath) {
    // Escapar las barras invertidas para JSON
    const escapedPath = chromePath.replace(/\\/g, '\\\\');
    
    const configContent = `module.exports = { 
  chromePath: "${escapedPath}", 
  detected: "${new Date().toLocaleDateString()}" 
}; `;
    
    fs.writeFileSync(path.join(__dirname, 'chrome-config.js'), configContent);
    
    console.log('¡Configuración actualizada correctamente!');
    console.log(`Chrome detectado en: ${chromePath}`);
    return true;
  } else {
    return false;
  }
}

// Ejecutar la función principal
if (updateChromeConfig()) {
  console.log('Ahora puedes ejecutar node server.js para iniciar MateChat');
} else {
  console.log('Por favor, actualiza manualmente la ruta de Chrome en chrome-config.js');
}