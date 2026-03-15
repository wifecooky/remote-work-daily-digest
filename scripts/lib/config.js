import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _config = null;

export function loadSiteConfig() {
  if (_config) return _config;
  const configPath = path.resolve(__dirname, '../../site.yaml');
  _config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
  return _config;
}
