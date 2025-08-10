import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const servicePath = path.join(__dirname, 'services/media-analysis');
const bigSisterPath = path.join(servicePath, '../../lib/BigSister/src');
const venvPath = path.join(bigSisterPath, '../../venv/bin/python');

console.log('Service path:', servicePath);
console.log('BigSister path:', bigSisterPath);
console.log('Venv path:', venvPath);
console.log('Resolved venv path:', path.resolve(venvPath));