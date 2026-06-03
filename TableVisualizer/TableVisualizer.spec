# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['table_visualizer_gui.py'],
    pathex=[],
    binaries=[],
    datas=[('excel_structure.json', '.'), ('relationship_graph.json', '.'), ('gui_config.json', '.')],
    hiddenimports=['openpyxl'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pandas', 'numpy', 'matplotlib', 'networkx', 'scipy', 'PIL', 'tkinter', 'test', 'unittest', 'pydoc', 'PyQt6.QtWebEngineCore', 'PyQt6.QtWebEngineWidgets', 'PyQt6.QtMultimedia', 'PyQt6.QtMultimediaWidgets', 'PyQt6.QtQml', 'PyQt6.QtQuick', 'PyQt6.QtQuick3D', 'PyQt6.Qt3DCore', 'PyQt6.QtSql', 'PyQt6.QtTest', 'PyQt6.QtBluetooth', 'PyQt6.QtPositioning', 'PyQt6.QtSensors', 'PyQt6.QtSerialPort', 'PyQt6.QtDesigner', 'PyQt6.QtHelp'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='TableVisualizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
app = BUNDLE(
    exe,
    name='TableVisualizer.app',
    icon=None,
    bundle_identifier=None,
)
