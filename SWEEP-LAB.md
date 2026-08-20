# MeshUtilz Sweep Lab

Isolated experimental workspace for the MeshUtilz Draw/Sweep system.

## Purpose
Develop and prove freehand path-to-mesh sweep geometry independently from the active MeshUtilz/Hair System build, so the known-good main application remains untouched.

## Initial scope
- Mouse and Apple Pencil path drawing
- Smoothed editable paths
- Circle, square, rectangle and triangle profiles
- Live swept mesh generation
- Profile size and resolution controls
- End caps and shading controls
- Undo/redo and delete/clear
- OBJ/GLB export

## Architecture rule
Drawing interaction, path processing, profile generation and sweep geometry must remain separate modules so the proven Sweep engine can later be integrated into MeshUtilz without a rewrite.

## Integration rule
Do not modify the active MeshUtilz/Hair System code from this repository. Integration happens only after Sweep Lab is proven and a known-good MeshUtilz checkpoint exists.
