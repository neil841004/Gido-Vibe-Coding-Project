const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sdlDir = path.join(rootDir, 'node_modules', '@kmamal', 'sdl');
const sdlScriptsDir = path.join(sdlDir, 'scripts');
const sdlBundleDir = path.join(sdlDir, 'sdl');
const sdlIncludeDir = path.join(sdlBundleDir, 'include');
const sdlLibDir = path.join(sdlBundleDir, 'lib');
const sdlDistDir = path.join(sdlDir, 'dist');
const bindingGypPath = path.join(sdlDir, 'binding.gyp');
const electronRebuildBin = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild'
);

function run(command, args, options = {}) {
    execFileSync(command, args, {
        cwd: options.cwd || rootDir,
        stdio: 'inherit',
        env: { ...process.env, ...options.env }
    });
}

function ensureSymlink(target, linkPath) {
    try {
        fs.rmSync(linkPath, { force: true });
        fs.symlinkSync(target, linkPath);
    } catch (error) {
        if (!fs.existsSync(linkPath)) throw error;
    }
}

function patchBindingGyp() {
    const original = fs.readFileSync(bindingGypPath, 'utf8');
    const escapedInclude = sdlIncludeDir.replace(/\\/g, '\\\\');
    const escapedLib = sdlLibDir.replace(/\\/g, '\\\\');
    const patched = original
        .replace(/'\$\(SDL_INC\)'/g, `'${escapedInclude}'`)
        .replace(/'-L\$\(SDL_LIB\)'/g, `'-L${escapedLib}'`);
    if (patched !== original) fs.writeFileSync(bindingGypPath, patched);
}

function copyBuiltArtifacts() {
    fs.mkdirSync(sdlDistDir, { recursive: true });
    fs.copyFileSync(
        path.join(sdlDir, 'build', 'Release', 'sdl.node'),
        path.join(sdlDistDir, 'sdl.node')
    );
    fs.copyFileSync(
        path.join(sdlLibDir, 'libSDL2-2.0.0.dylib'),
        path.join(sdlDistDir, 'libSDL2-2.0.0.dylib')
    );
    ensureSymlink('libSDL2-2.0.0.dylib', path.join(sdlDistDir, 'libSDL2-2.0.dylib'));
    ensureSymlink('libSDL2-2.0.0.dylib', path.join(sdlDistDir, 'libSDL2.dylib'));
}

function main() {
    if (process.platform !== 'darwin') {
        console.log('[gamepad] SDL Electron rebuild skipped: macOS is the only configured target.');
        return;
    }
    if (!fs.existsSync(sdlDir)) {
        console.log('[gamepad] SDL Electron rebuild skipped: @kmamal/sdl is not installed.');
        return;
    }

    const electronVersion = require('electron/package.json').version;
    run(process.execPath, ['download-sdl.mjs'], { cwd: sdlScriptsDir });
    ensureSymlink('libSDL2-2.0.0.dylib', path.join(sdlLibDir, 'libSDL2.dylib'));
    patchBindingGyp();
    run(electronRebuildBin, ['-f', '-w', '@kmamal/sdl', '-v', electronVersion]);
    copyBuiltArtifacts();
    console.log(`[gamepad] Rebuilt @kmamal/sdl for Electron ${electronVersion}.`);
}

main();
