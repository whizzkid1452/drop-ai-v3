# Drop AI v3 Phase Specification

## Goal

Drop AI v3의 장기 목표는 Ardour reference에서 확인되는 DAW(Digital Audio Workstation) 사용자 기능 표면을 브라우저에서 실행 가능한 형태로 옮기고, 모든 쓰기 작업을 command로 조작할 수 있게 만드는 것이다.

여기서 command는 터미널 shell command가 아니라 `AppController.executeCommand(rawCommand)`로 전달되는 plain object 명령을 뜻한다. 예시는 다음과 같다.

```ts
await appController.executeCommand({
  type: 'region.move',
  payload: {
    trackId: 'track-1',
    regionId: 'region-1',
    startTime: 12.5,
  },
});
```

## Scope And Evidence

### Directly Known Facts

- 현재 Drop AI v3는 `asset.register`, `track.*`, `region.*`, `playback.*`, `session.export` 계열 command를 가진다.
- 현재 session state는 track, region, playback, loop, BPM, master volume을 plain object로 보관한다.
- Ardour reference의 `doc/mainpage.md`는 주요 구성 요소를 GUI front-end, `libardour`, headless 실행, session utility, Lua command-line interface, control surface, audio/MIDI backend, MIDI/event library, tempo/time library, panner, export graph, waveform rendering으로 나눈다.
- Ardour reference의 `gtk2_ardour/ardour.menus.in`은 Session, Transport, Edit, Region, Track, View, Window, Processor popup, Region List popup 기능을 메뉴 action으로 노출한다.
- Ardour reference의 `doc/region_ops.txt`는 region operation이 selection, entered region, edit point에 따라 다른 대상 집합을 사용한다고 설명한다.
- Ardour reference의 `share/export`에는 WAV, BWAV, FLAC, Ogg Vorbis, MP3, CD, streaming 대상 preset/format 파일이 있다.
- Ardour reference의 `share/midi_maps`, `share/mcp`, `share/osc`에는 MIDI controller, Mackie Control Protocol 계열 controller, OSC preset 자료가 있다.

### Inferences

- Drop AI가 Ardour 수준의 DAW 기능을 command로 조작하려면 단순 CRUD command만으로는 부족하다. selection state, edit point, range selection, command history, side-effect ordering을 command 실행 컨텍스트로 모델링해야 한다.
- Ardour의 전체 C++ 함수 목록을 그대로 이식하는 것은 이 프로젝트의 목표와 다르다. 이 문서의 "모든 기능"은 Ardour reference에서 사용자 기능으로 드러나는 DAW 기능군을 뜻한다.
- 브라우저 제품이므로 JACK, ALSA, CoreAudio, ASIO 같은 native audio backend 기능은 Web Audio 기반 adapter로 대체하거나, 별도 desktop wrapper phase에서 다루는 것이 현실적이다.

### Assumptions

- 우선 실행 대상은 browser app이다.
- `command-first`는 제품 문구가 아니라 내부 실행 계약이다.
- phase는 PR 단위가 아니다. 하나의 phase는 여러 PR로 쪼갤 수 있다.
- "feature complete"는 Ardour와 동일한 UI를 만드는 뜻이 아니라, 같은 작업 의도를 command로 표현하고 Drop AI UI/CLI/shortcut/automation에서 같은 실행 경계를 공유한다는 뜻이다.

## Command Architecture Contract

### Command Categories

- `session.*`: project lifecycle, save/load, metadata, cleanup, archive, template.
- `asset.*`: imported media, decoded buffers, binary persistence, source list.
- `track.*`: audio/MIDI track lifecycle, order, height, playlist, record arm.
- `route.*`: track, bus, VCA, foldback, monitor, input/output routing.
- `region.*`: audio/MIDI region placement, trim, gain, fade, layering, analysis, bounce.
- `selection.*`: selected tracks, selected regions, note selection, range selection.
- `editPoint.*`: playhead, mouse-derived edit position, active marker, sync point.
- `transport.*` or existing `playback.*`: roll, stop, seek, loop, punch, preroll, count-in, click.
- `record.*`: record enable, record start/stop, capture handling, discard capture.
- `mixer.*`: gain, pan, mute, solo, metering view, monitor mode.
- `processor.*`: plugin/insert/send chain operation.
- `automation.*`: lane visibility, control points, automation mode, envelopes.
- `midi.*` and `note.*`: MIDI region and note editing.
- `tempo.*`, `meter.*`, `clock.*`: tempo map, time signature, ruler, time display.
- `import.*`, `export.*`: file import, stem export, region export, interchange formats.
- `video.*`: video import, timeline sync, video monitor, video export.
- `view.*`: zoom, scroll, saved views, visible panels, rulers.
- `script.*`, `surface.*`, `remote.*`: scripting, control surfaces, OSC/MIDI remote control.

### Required Implementation For Every Write Command

1. Define a strict schema.
2. Register command metadata in one registry.
3. Route execution through `AppController.executeCommand()`.
4. Keep UI, CLI, keyboard shortcut, replay, script, and remote input on the same command path.
5. Update session state for user-visible state changes.
6. Isolate runtime side effects behind interfaces such as `IAudioEngine`, repository adapters, or plugin adapters.
7. Add controller tests for state changes and side effects.
8. Add parser or UI adapter tests when the command is exposed through text input or UI interaction.
9. Add audio/export verification when the command changes rendered sound.

### Undo Policy

Undo must be a command-system feature, not a UI-only feature.

- `history.undo` and `history.redo` reverse commands that mutate session state.
- Selection history can be separate: `selection.undo` and `selection.redo`.
- Commands that trigger non-reversible external side effects must declare `undoable: false`.
- A command that mutates session state and triggers audio-engine side effects must record enough before-state to restore both session state and audio scheduling.

## Phase Overview

| Phase | Name | Primary Capability | Ardour Feature Surface Covered |
| --- | --- | --- | --- |
| 0 | Current Vertical Slice | Real audio upload, basic region edit, playback, WAV export | Minimal Session, Track, Region, Transport, Export |
| 1 | Command Kernel And Project State | Stable command registry, selection context, persistence | Session lifecycle, save/load, snapshot, metadata, cleanup |
| 2 | Timeline Editing Foundation | Timeline, ranges, markers, grid, edit point, view state | Edit menu, View menu, marker/range/ruler actions |
| 3 | Region Editing Parity Layer | Full audio region command set | Region menu, Region popup, region operation rules |
| 4 | Transport And Recording | Playback modes, loop/punch, click, capture | Transport menu, recorder controls |
| 5 | Mixer, Routing, And Monitoring | Track/bus/VCA/foldback routing and mixer state | Track menu, Mixer actions, monitor section, port matrix |
| 6 | Processor Chain And Plugins | Inserts, sends, plugin lifecycle, plugin controls | Processor popup, plugin manager, DSP load |
| 7 | MIDI Authoring | MIDI regions, piano roll, note editing, MIDI import/export | MIDI region menu, note actions, MIDI maps |
| 8 | Automation, Tempo, And Time | Automation lanes, tempo map, clocks, external sync | Automation, tempo, meter, timecode, ruler actions |
| 9 | Import, Export, Interchange, And Video | Rich export/import, stems, video timeline | Export presets, metadata, video actions, AAF/PT-style interchange |
| 10 | Scripting, Control Surfaces, And Headless Operation | Command bus exposed to scripts and remote controllers | Lua session, session utils, OSC, MIDI maps, MCP surfaces, headless |

## Phase 0. Current Vertical Slice

### Goal

Maintain a working browser DAW vertical slice while later phases expand the feature surface.

### Included Features

- Upload an audio file and register it as an asset.
- Create tracks and place asset-backed regions.
- Move, split, resize, and remove regions.
- Play, pause, stop, seek, loop, set BPM, and set master volume.
- Set track volume, mute, solo, and pan.
- Export the current session as a WAV file.

### Existing Command Surface

- `asset.register`
- `track.add`
- `track.remove`
- `track.volume.set`
- `track.mute.set`
- `track.solo.set`
- `track.pan.set`
- `region.add`
- `region.move`
- `region.split`
- `region.resize`
- `region.remove`
- `playback.play`
- `playback.pause`
- `playback.stop`
- `playback.seek`
- `playback.loop.set`
- `playback.bpm.set`
- `playback.masterVolume.set`
- `session.export`

### Exit Criteria

- Existing command schema tests, controller tests, and integration tests pass.
- Uploaded audio is audible in the browser.
- Exported WAV contains non-empty rendered audio when audible regions exist.
- New phases do not bypass `executeCommand()` for write operations.

## Phase 1. Command Kernel And Project State

### Goal

Make command execution, project identity, persistence, and selection context stable enough for complex DAW operations.

### Included Features

- New, open, close, save, save as, rename, snapshot, and recent project list.
- Project metadata edit/import.
- Session template create/manage.
- Archive and cleanup commands.
- Asset source list and unused asset cleanup.
- Command registry as the source of truth for schema, CLI usage, shortcut binding, undo policy, and command description.
- Command history with undo/redo.
- Selection state for tracks, regions, ranges, MIDI notes, automation points, and processors.
- Edit point state: playhead, active marker, mouse-derived point, region sync point.
- Project persistence with session JSON and asset blob storage.

### Command Examples

- `session.new`
- `session.open`
- `session.close`
- `session.save`
- `session.saveAs`
- `session.rename`
- `session.snapshot.create`
- `session.template.create`
- `session.archive`
- `session.metadata.set`
- `asset.cleanupUnused`
- `selection.set`
- `selection.clear`
- `editPoint.set`
- `history.undo`
- `history.redo`

### Exit Criteria

- A saved project can be reopened with identical track order, region order, region timing, playback settings, and asset references.
- Undo/redo works for at least track add/remove and region add/move/split/remove.
- Selection-dependent commands declare their target rule explicitly.
- UI and CLI command discovery are generated from the same registry.

## Phase 2. Timeline Editing Foundation

### Goal

Build the editor substrate: timeline, waveform display, grid, markers, range selection, edit point behavior, and view state.

### Included Features

- Waveform timeline with multiple tracks.
- Track order, track height, selected track navigation, and visible track count.
- Playhead, active marker, and range selection.
- Marker add/remove/toggle, named markers, CD/cue/location marker display filters.
- Loop, punch, and session range assignment from selection or markers.
- Grid and snap modes: none, bar, beat, beat divisions, triplets, quintuplets, septuplets, timecode, minutes/seconds, CD frame.
- Global quantization values.
- Rulers: minutes/seconds, timecode, samples, bars/beats/ticks, meter, tempo, range, marker, arrangement, video.
- Clocks: primary and secondary clock display mode.
- View commands: zoom in/out, zoom to session, zoom to extents, zoom to selection, scroll, saved visual states.
- Section editing: cut/paste range, copy/paste range, delete range, insert time, remove time.

### Command Examples

- `timeline.grid.set`
- `timeline.snapMode.set`
- `timeline.globalQuantization.set`
- `marker.add`
- `marker.remove`
- `marker.goto`
- `range.set`
- `range.select`
- `loop.setFromRange`
- `punch.setFromRange`
- `view.zoom.set`
- `view.scroll`
- `view.savedState.save`
- `view.savedState.goto`
- `edit.section.cutPaste`
- `edit.section.copyPaste`
- `edit.section.delete`
- `edit.time.insert`
- `edit.time.remove`

### Exit Criteria

- Region commands can target either explicit IDs or the current selection/edit-point context.
- Timeline state survives save/load.
- Grid snapping changes both visual placement and command-calculated region positions.
- View commands mutate view state only; they must not mutate audio session state.

## Phase 3. Region Editing Parity Layer

### Goal

Cover Ardour-style audio region operations as command-addressable domain behavior.

### Included Features

- Insert region from source list.
- Play selected regions.
- Rename, tag, group, and ungroup regions.
- Crop, split, separate under region, separate from loop, separate from punch.
- Consolidate, consolidate with processing, combine, and uncombine.
- Align by start, end, sync point, and relative variants.
- Trim front, trim back, trim to loop, trim to punch, trim to previous region, trim to next region.
- Duplicate, multi-duplicate, fill track, sequence regions.
- Region layering: raise, raise to top, lower, lower to bottom, choose top.
- Region locks: position lock, video lock.
- Region sync point set/remove.
- Region gain: normalize, boost, cut, reset, reset envelope, invert polarity, envelope active.
- Region mute and opaque state.
- Fades: enable/disable fade in, fade out, both fades; set fade length.
- Reverse region.
- Strip silence.
- Split at transients and place transient.
- Close gaps.
- Pitch shift and time stretch.
- Multichannel split to mono regions.
- Bounce processed/unprocessed and export selected region.
- Spectral analysis and loudness analysis.
- Region cue markers and conversion to global/CD markers.

### Command Examples

- `region.rename`
- `region.group`
- `region.ungroup`
- `region.crop`
- `region.separate`
- `region.consolidate`
- `region.combine`
- `region.uncombine`
- `region.align`
- `region.trim`
- `region.duplicate`
- `region.layer.set`
- `region.lock.set`
- `region.syncPoint.set`
- `region.gain.set`
- `region.gain.normalize`
- `region.fade.set`
- `region.reverse`
- `region.stripSilence`
- `region.transient.split`
- `region.pitchShift`
- `region.timeStretch`
- `region.bounce`
- `region.export`
- `region.analysis.run`
- `region.marker.add`

### Exit Criteria

- Target resolution follows explicit rules for selected regions, entered regions, and edit-point regions.
- Every destructive region command is undoable unless declared otherwise.
- Audio rendering reflects gain, fade, mute, reverse, trim, split, and bounce operations.
- Region analysis commands produce deterministic structured results for tests.

## Phase 4. Transport And Recording

### Goal

Implement full playback and capture behavior as commands, including transport modes that depend on loop, punch, preroll, count-in, and record state.

### Included Features

- Start/stop, start/continue/stop, stop and forget capture.
- Play selection, solo selection, play with preroll, play from edit point and return.
- Loop range playback.
- Forward, rewind, slow/fast variants, reverse transition.
- Playhead movement to edit point, marker, loop start/end, session start/end, wall clock, grid, region boundary, region sync point.
- Record enable, start recording, record with preroll, record with count-in.
- Punch, punch-in, punch-out, auto input, follow edits, auto play, auto return.
- Click/metronome enable and click asset configuration.
- Panic command for stuck playback/MIDI notes.
- Cue trigger slots.
- Capture tagging and removal of last capture.

### Command Examples

- `transport.roll.toggle`
- `transport.stop`
- `transport.stopAndForgetCapture`
- `transport.playSelection`
- `transport.playFromEditPoint`
- `transport.forward`
- `transport.rewind`
- `transport.playhead.goto`
- `transport.playhead.nudge`
- `transport.option.set`
- `record.enable.set`
- `record.start`
- `record.capture.discardLast`
- `click.set`
- `panic`
- `cue.trigger`

### Exit Criteria

- Transport state is observable from session state.
- Recording writes an asset-backed region into the session.
- Punch recording creates regions only inside the punch range.
- `panic` stops active scheduled sources and clears stuck MIDI notes when MIDI exists.

## Phase 5. Mixer, Routing, And Monitoring

### Goal

Model track, bus, VCA, foldback, monitor, and route behavior with command-controlled mixer state and an audio graph adapter.

### Included Features

- Add audio track, MIDI track, bus, VCA, and foldback route.
- Duplicate and remove tracks/busses.
- Track record enable, solo, mute, solo isolate, active state.
- Track playlist management: new/copy playlists for all, armed, or selected tracks.
- Track movement, height, and visibility.
- Mixer strip selection and navigation.
- Gain, pan, mute, solo, record enable, input monitoring, disk monitoring.
- Master route and monitor section: cut, dim, mono, monitor enable.
- Foldback strip.
- VCA pane and VCA assignment.
- Internal audio routing matrix.
- Input/output connection manager equivalent for browser graph endpoints.
- Meter bridge and per-route meters.
- Remove gaps across tracks.

### Command Examples

- `route.add`
- `route.duplicate`
- `route.remove`
- `route.order.move`
- `route.active.set`
- `route.recordEnable.set`
- `route.monitorMode.set`
- `route.playlist.create`
- `route.playlist.copy`
- `mixer.gain.set`
- `mixer.pan.set`
- `mixer.mute.set`
- `mixer.solo.set`
- `mixer.vca.assign`
- `monitor.section.set`
- `routing.connect`
- `routing.disconnect`
- `meter.snapshot`

### Exit Criteria

- Mixer commands update session state and audio graph state consistently.
- Solo/mute behavior is tested for multiple tracks, busses, and master output.
- Meter data is read-only telemetry, not session mutation.
- Browser routing limitations are documented where native audio ports cannot be represented directly.

## Phase 6. Processor Chain And Plugins

### Goal

Support command-controlled processors: plugins, inserts, sends, aux sends, foldback sends, inline controls, presets, and chain operations.

### Included Features

- Add new plugin, external insert, external send, aux send, foldback send.
- Remove foldback send.
- Processor rename, edit, generic edit, inline controls.
- Processor cut, copy, paste, delete.
- Select/deselect processors.
- Activate/deactivate all processors.
- Toggle selected processors and A/B selected plugins.
- Clear all, pre-fader, and post-fader processors.
- Manage pins and channel mapping.
- Send options.
- Preset load/save.
- Plugin manager and plugin scan result state.
- Plugin DSP load and DSP statistics.
- Latency compensation metadata.

### Command Examples

- `processor.add`
- `processor.remove`
- `processor.rename`
- `processor.order.move`
- `processor.copy`
- `processor.cut`
- `processor.paste`
- `processor.active.set`
- `processor.ab.toggle`
- `processor.clear`
- `processor.pinMap.set`
- `processor.preset.load`
- `processor.parameter.set`
- `plugin.scan`
- `plugin.manager.open`
- `dsp.stats.snapshot`

### Exit Criteria

- Browser-native processors work before any desktop-only plugin format is attempted.
- Processor order changes are audible in rendered output.
- Processor parameter automation can be attached in Phase 8 without changing the command identity.
- Plugin scan crashes or load failures are represented as structured errors, not silent failures.

## Phase 7. MIDI Authoring

### Goal

Add MIDI tracks, MIDI regions, MIDI note editing, and instrument routing as first-class command-controlled behavior.

### Included Features

- MIDI asset import and Standard MIDI File export.
- MIDI track and instrument route.
- Piano roll and list editor.
- MIDI note add, delete, move, resize, duplicate, select, invert selection, extend selection.
- Note start/end fine movement.
- Note velocity increase/decrease with fine, relative, non-relative, and ratio-preserving variants.
- Transpose by octave and semitone.
- Nudge notes by grid and fine grid.
- Split notes on grid, split into more/less pieces, join notes.
- Strum forward/backward.
- Edit note channel and note velocity.
- Quantize selected notes and quantize MIDI regions.
- Legatize and remove overlap.
- Transform MIDI region.
- Fork linked MIDI regions and unlink from unselected regions.
- Deinterlace MIDI into layers.
- Insert patch changes.
- Draw settings for note length, velocity, and MIDI channel.
- Virtual keyboard.
- MIDI controller maps.

### Command Examples

- `midi.import`
- `midi.export`
- `midi.region.quantize`
- `midi.region.transpose`
- `midi.region.transform`
- `midi.region.deinterlace`
- `midi.patchChange.insert`
- `note.add`
- `note.remove`
- `note.move`
- `note.resize`
- `note.select`
- `note.velocity.adjust`
- `note.transpose`
- `note.quantize`
- `note.split`
- `note.join`
- `note.strum`
- `midi.draw.length.set`
- `midi.draw.velocity.set`
- `midi.draw.channel.set`
- `midi.controllerMap.load`

### Exit Criteria

- MIDI note edits are undoable.
- MIDI playback is audible through an instrument processor or internal synth.
- MIDI export preserves note timing, length, velocity, channel, and patch changes.
- Audio and MIDI regions can coexist on the same timeline without sharing invalid assumptions about sample data.

## Phase 8. Automation, Tempo, And Time

### Goal

Represent continuous control data, tempo maps, meter maps, and multiple time domains precisely enough for editing, playback, and export.

### Included Features

- Automation lane show/hide and toggle all existing automation.
- Automation control points, curves, range edits, and copy/paste.
- Track automation for gain, pan, mute, plugin parameters, sends, and monitor-relevant parameters.
- Region gain envelope automation.
- Automation modes such as manual, play, write, touch, latch when supported.
- Tempo map edit and tempo from region/range.
- Meter/time-signature edit.
- Musical time and absolute time conversion.
- Primary and secondary clock modes: timecode, bars/beats/ticks, minutes/seconds, samples.
- Timecode frame rate and external sync.
- Follow playhead, stationary playhead, follow edits.
- Pull-up/pull-down style sync metadata when needed.

### Command Examples

- `automation.lane.setVisible`
- `automation.point.add`
- `automation.point.move`
- `automation.point.remove`
- `automation.range.write`
- `automation.mode.set`
- `tempo.set`
- `tempo.setFromRegion`
- `tempo.setFromRange`
- `meter.set`
- `clock.primary.setMode`
- `clock.secondary.setMode`
- `sync.external.set`
- `transport.follow.set`

### Exit Criteria

- Automation playback and export use the same automation evaluation path.
- Tempo and meter changes affect grid, ruler, MIDI note display, and transport timing consistently.
- Time conversion is covered by unit tests for seconds, samples, BBT, and timecode.

## Phase 9. Import, Export, Interchange, And Video

### Goal

Extend file exchange beyond the initial WAV export and support video-timeline workflows where browser constraints allow it.

### Included Features

- Audio import into source list and directly onto timeline.
- Quick export and full export.
- Region export, stem export, and session export.
- Export presets and formats: WAV, BWAV, FLAC, Ogg Vorbis, MP3, CD-oriented output, streaming-oriented output.
- Export filename, channel format, sample format, sample rate, normalization, loudness target, and metadata.
- Loudness assistant.
- Mixer strip import/export.
- Project archive.
- AAF/PT-style interchange adapter if licensing and browser execution constraints allow it.
- Video open/remove.
- Video timeline ruler and video monitor.
- Video export with audio render.
- Video lock for regions.

### Command Examples

- `import.audio`
- `import.sessionInterchange`
- `import.mixerStrip`
- `export.quick`
- `export.session`
- `export.stem`
- `export.region`
- `export.format.set`
- `export.preset.load`
- `export.metadata.set`
- `export.loudness.analyze`
- `archive.create`
- `video.open`
- `video.close`
- `video.export`
- `video.monitor.set`

### Exit Criteria

- Exported files open in common players and contain the expected duration and channel count.
- Stem export renders one file per selected route or bus according to command payload.
- Metadata changes appear in supported exported formats.
- Video commands degrade with explicit unsupported errors when the browser cannot perform the requested operation.

## Phase 10. Scripting, Control Surfaces, And Headless Operation

### Goal

Expose the same command system to scripts, remote controllers, non-interactive tools, and headless workflows.

### Included Features

- Script manager.
- Script slots and script execution.
- Headless session open, command execution, and export.
- Non-interactive command-line utilities for session export and project inspection.
- Remote command API for browser automation.
- OSC preset support.
- MIDI controller maps.
- Mackie Control Protocol-style surface profiles.
- Web surface protocol.
- Key binding editor.
- Command replay and macro recording.
- Log window and structured command audit log.

### Command Examples

- `script.run`
- `script.slot.assign`
- `headless.session.open`
- `headless.command.run`
- `remote.server.start`
- `remote.server.stop`
- `surface.enable`
- `surface.map.load`
- `keymap.bind`
- `macro.record.start`
- `macro.record.stop`
- `macro.run`
- `log.export`

### Exit Criteria

- A headless command sequence can open a saved project, mutate it, export audio, and exit without the React app.
- Scripted commands use the same schema and controller dispatch as UI commands.
- Remote/controller input cannot bypass validation.
- Command audit logs are sufficient to reproduce a session mutation sequence.

## Cross-Phase Verification Rules

- `pnpm test` must pass for command schema, controller, session operation, parser, and audio-engine tests.
- `pnpm typecheck` and `pnpm lint` must pass before merging implementation work.
- Commands that change audio rendering need at least one fake-engine unit test and one product-engine test when feasible.
- Commands that change persistence need save/load round-trip tests.
- Commands exposed through UI need adapter tests that prove the UI emits a command, not direct domain mutation.
- Commands exposed through CLI or scripts need parser tests.
- Feature docs must not claim measured impact unless a measurement exists.

## Coverage Matrix

| Ardour Reference Feature Group | Drop AI Phase |
| --- | --- |
| Session new/open/close/save/rename/snapshot/save as | Phase 1 |
| Templates, archive, metadata, cleanup | Phase 1 and Phase 9 |
| Audio import and source list | Phase 1 and Phase 9 |
| Transport roll, stop, loop, preroll, count-in, click, punch | Phase 4 |
| Playhead, markers, ranges, grid, rulers, clocks | Phase 2 and Phase 8 |
| Edit selection, section cut/copy/delete/insert/remove time | Phase 2 |
| Audio region trim, split, align, duplicate, gain, fade, layering | Phase 3 |
| Region analysis, transient tools, pitch/time processing, bounce | Phase 3 |
| Track add/remove/duplicate/order/playlist/height | Phase 5 |
| Mixer strips, busses, VCA, foldback, monitor, meters | Phase 5 |
| Routing and connection managers | Phase 5 |
| Processor chain, inserts, sends, plugins, presets, pins | Phase 6 |
| Plugin manager and DSP statistics | Phase 6 |
| MIDI tracks, MIDI regions, notes, quantize, patch changes | Phase 7 |
| MIDI controller maps and virtual keyboard | Phase 7 and Phase 10 |
| Automation lanes, control points, region gain envelopes | Phase 8 |
| Tempo map, meter map, timecode, external sync | Phase 8 |
| Export formats, presets, stems, region export | Phase 9 |
| Video import, video monitor, video export, video lock | Phase 9 |
| Lua/session scripting, headless, session utilities | Phase 10 |
| OSC, Mackie Control Protocol profiles, web surfaces | Phase 10 |
| View layout, saved views, panel visibility, zoom/scroll | Phase 2 and Phase 10 |

## Open Questions

- Browser-only deployment cannot directly host native VST/LV2/AU plugins. The project needs a product decision between browser-native processors, WebAssembly processors, remote processing, or desktop wrapper support.
- Browser-only deployment cannot expose JACK/ALSA/CoreAudio/ASIO ports directly. The first routing model should target internal Web Audio graph routing.
- Real recording requires a browser microphone/file capture policy and permission UX. The command model can be defined before the final UX exists, but capture verification depends on browser permission behavior.
- AAF/PT interchange may require native code, WebAssembly, or server-side conversion. This is not proven from current Drop AI code.
- Video export may require browser `MediaRecorder`, WebCodecs, ffmpeg.wasm, or server-side rendering. The required substrate is not determined by the Ardour reference alone.
