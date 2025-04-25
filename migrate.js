#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const sourceDir = '/tmp/TemplateViteReact';
const targetDir = '.';

// Files to exclude from copying
const excludeDirs = ['.git', 'node_modules', 'temp_migration'];
const excludeFiles = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite-env.d.ts', 'direct_migration.js', 'convert_ts_to_js.js', 'migrate.js'];

// Function to copy files recursively
function copyFiles(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    // Skip excluded directories
    if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
      continue;
    }

    // Skip excluded files
    if (!entry.isDirectory() && excludeFiles.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyFiles(sourcePath, destPath);
    } else {
      // Determine if we need to rename the file (ts/tsx to js/jsx)
      let destFileName = destPath;
      if (destPath.endsWith('.ts') && !destPath.endsWith('.d.ts')) {
        destFileName = destPath.replace(/\.ts$/, '.js');
      } else if (destPath.endsWith('.tsx')) {
        destFileName = destPath.replace(/\.tsx$/, '.jsx');
      }

      // Read the file content
      let content = fs.readFileSync(sourcePath, 'utf8');

      // Convert TypeScript to JavaScript
      if (sourcePath.endsWith('.ts') || sourcePath.endsWith('.tsx')) {
        // Remove type annotations
        content = removeTypeAnnotations(content);
      }

      // Write the file
      fs.writeFileSync(destFileName, content);
      console.log(`Copied and converted: ${sourcePath} -> ${destFileName}`);
    }
  }
}

// Function to remove TypeScript-specific syntax
function removeTypeAnnotations(content) {
  // Remove import type statements
  content = content.replace(/import\s+type\s+.*?from\s+['"].*?['"]/g, '');
  
  // Remove import { type X } statements
  content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]([^'"]+)['"]/g, (match, imports, from) => {
    // Remove 'type' keywords from imports
    const cleanedImports = imports.replace(/\btype\s+/g, '');
    return `import {${cleanedImports}} from '${from}'`;
  });

  // Remove interface declarations
  content = content.replace(/interface\s+\w+(\s+extends\s+\w+)?\s*{[^}]*}/gs, '');

  // Remove type declarations
  content = content.replace(/type\s+\w+(\s*<[^>]*>)?\s*=\s*[^;]*;/g, '');

  // Remove enum declarations
  content = content.replace(/enum\s+\w+\s*{[^}]*}/g, '');

  // Remove type assertions
  content = content.replace(/as\s+\w+(\[\])?/g, '');

  // Remove type parameters in generic functions/classes
  content = content.replace(/<[^<>]*>/g, '');

  // Remove parameter type annotations
  content = content.replace(/(\w+)\s*:\s*[^,)=]*/g, '$1');

  // Remove return type annotations
  content = content.replace(/\)\s*:\s*[^{]*/g, ') ');

  // Remove type annotations in variable declarations
  content = content.replace(/const\s+(\w+)\s*:\s*[^=]*/g, 'const $1 ');
  content = content.replace(/let\s+(\w+)\s*:\s*[^=]*/g, 'let $1 ');
  content = content.replace(/var\s+(\w+)\s*:\s*[^=]*/g, 'var $1 ');

  return content;
}

// Update package.json to remove TypeScript dependencies
function updatePackageJson() {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Update scripts
    if (packageJson.scripts) {
      if (packageJson.scripts.build) {
        packageJson.scripts.build = packageJson.scripts.build.replace('tsc -b && ', '');
      }
      // Add any other script modifications here
    }

    // Remove TypeScript-related devDependencies
    const tsDevDeps = [
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@types/redux-logger',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'typescript'
    ];

    if (packageJson.devDependencies) {
      tsDevDeps.forEach(dep => {
        if (packageJson.devDependencies[dep]) {
          delete packageJson.devDependencies[dep];
        }
      });
    }

    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Updated package.json');
  }
}

// Create vite.config.js from vite.config.ts
function createViteConfig() {
  const viteConfigTsPath = path.join(sourceDir, 'vite.config.ts');
  const viteConfigJsPath = path.join(targetDir, 'vite.config.js');

  if (fs.existsSync(viteConfigTsPath)) {
    const viteConfigContent = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});`;
    
    // Write the JavaScript version
    fs.writeFileSync(viteConfigJsPath, viteConfigContent);
    console.log('Created vite.config.js');
  }
}

// Update ESLint configuration
function updateEslintConfig() {
  const eslintConfigPath = path.join(targetDir, 'eslint.config.js');
  
  if (fs.existsSync(eslintConfigPath)) {
    let content = fs.readFileSync(eslintConfigPath, 'utf8');
    
    // Remove TypeScript-specific ESLint plugins and rules
    content = content.replace(/@typescript-eslint\/[^,}]+,?/g, '');
    
    // Write the updated config
    fs.writeFileSync(eslintConfigPath, content);
    console.log('Updated ESLint configuration');
  }
}

// Fix common issues in converted files
function fixCommonIssues() {
  // Fix App.jsx
  const appJsxPath = path.join(targetDir, 'src', 'App.jsx');
  if (fs.existsSync(appJsxPath)) {
    const appContent = `import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src="/react.svg" className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;`;
    fs.writeFileSync(appJsxPath, appContent);
    console.log('Fixed App.jsx');
  }

  // Fix main.jsx
  const mainJsxPath = path.join(targetDir, 'src', 'main.jsx');
  if (fs.existsSync(mainJsxPath)) {
    const mainContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './assets/styles/custom.css';
import Routes from './routes/routes';
import { store } from './store';

const WebApp = () => {
  return (
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <Routes />
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
};

export default WebApp;

// Ensure "root" is not null before rendering
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<WebApp />);`;
    fs.writeFileSync(mainJsxPath, mainContent);
    console.log('Fixed main.jsx');
  }

  // Fix store.js
  const storeJsPath = path.join(targetDir, 'src', 'store.js');
  if (fs.existsSync(storeJsPath)) {
    const storeContent = `import { configureStore } from '@reduxjs/toolkit';
import logger from 'redux-logger';
import userReducer from './slices/userSlice';
import authReducer from './slices/authSlice';

import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

import { combineReducers } from 'redux';

// Combine reducers
const rootReducer = combineReducers({
  user: userReducer,
  auth: authReducer,
});

// Persist config
const persistConfig = {
  key: 'root',
  storage,
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Middleware
const middlewares = [];

if (import.meta.env.VITE_ENV_NAME === 'development') {
  middlewares.push(logger);
}

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(middlewares),
});

export const persistor = persistStore(store);`;
    fs.writeFileSync(storeJsPath, storeContent);
    console.log('Fixed store.js');
  }
}

// Main execution
try {
  // Copy and convert files
  copyFiles(sourceDir, targetDir);

  // Update configuration files
  updatePackageJson();
  createViteConfig();
  updateEslintConfig();

  // Fix common issues
  fixCommonIssues();

  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Error during migration:', error);
}
