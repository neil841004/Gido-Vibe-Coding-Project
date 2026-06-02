# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['table_visualizer_gui.py'],
    pathex=[],
    binaries=[],
    datas=[('excel_structure.json', '.'), ('relationship_graph.json', '.'), ('gui_config.json', '.')],
    hiddenimports=['openpyxl', 'pandas', 'PyQt6'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='TableVisualizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TableVisualizer',
)
app = BUNDLE(
    coll,
    name='TableVisualizer.app',
    icon=None,
    bundle_identifier=None,
)
