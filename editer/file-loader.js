const fs = require('fs');
const path = require('path');

module.exports = {
  read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  },
  write(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
  },
  detectLanguage(filePath) {
    const ext = path.extname(filePath).slice(1);
    const map = {
      js: 'javascript',
      py: 'python',
      html: 'html',
      css: 'css',
      csv: 'plaintext',
      txt: 'plaintext'
    };
    return map[ext] || 'plaintext';
  }
};
