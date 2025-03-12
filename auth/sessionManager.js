const fs = require('fs');
const path = require('path');
const { useSingleFileAuthState } = require('@adiwajshing/baileys');

const authFile = path.join(__dirname, '../auth_info_multi.json');

function getAuthState() {
  let state;
  if (fs.existsSync(authFile)) {
    state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  } else {
    state = {};
  }
  return state;
}

function saveAuthState(state) {
  fs.writeFileSync(authFile, JSON.stringify(state, null, 2));
}

const { state, saveState } = useSingleFileAuthState(getAuthState(), saveAuthState);

module.exports = { state, saveState };