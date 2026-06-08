import { useState } from 'react';
import { useAppController, useSessionState } from './AppProvider';

export default function App() {
  const controller = useAppController();
  const session = useSessionState();
  const [commandMessage, setCommandMessage] = useState('Ready');
  const tracks = session.trackOrder.map(
    (trackId) => session.tracksById[trackId]
  );

  async function handleAddTrack() {
    const result = await controller.executeCommand({ type: 'track.add' });

    if (result.ok) {
      setCommandMessage(`Added ${result.data.id}`);
      return;
    }

    setCommandMessage(result.error.message);
  }

  return (
    <main data-testid="app-shell">
      <h1>Drop AI v3</h1>
      <p>Command-first app shell is ready.</p>
      <section aria-label="Session summary">
        <p data-testid="session-id">Session: {session.id}</p>
        <p data-testid="track-count">Tracks: {tracks.length}</p>
        <p data-testid="command-message">{commandMessage}</p>
      </section>
      <button data-testid="add-track" type="button" onClick={handleAddTrack}>
        Add Track
      </button>
      <ul data-testid="track-list">
        {tracks.map((track) => (
          <li data-testid="track-row" key={track.id}>
            {track.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
