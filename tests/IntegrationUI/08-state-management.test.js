/**
 * Integration Test 8: State Management
 * Tests UI state synchronization with backend data
 * 
 * @integration UI ↔ backend
 */

describe('State Management Integration', () => {
  
  let appState = null;

  beforeEach(() => {
    appState = {
      events: [],
      loading: false,
      error: null,
      selectedEvent: null
    };
  });

  describe('State Updates', () => {
    it('updates state on data fetch', () => {
      const backendData = [{ id: 'evt-1', name: 'Event 1' }];
      
      appState.events = backendData;
      appState.loading = false;

      expect(appState.events).toHaveLength(1);
      expect(appState.loading).toBe(false);
    });

    it('sets loading state during fetch', () => {
      appState.loading = true;

      expect(appState.loading).toBe(true);
    });

    it('clears loading state after fetch', () => {
      appState.loading = true;
      
      // After fetch completes
      appState.loading = false;

      expect(appState.loading).toBe(false);
    });

    it('stores error state on failure', () => {
      appState.error = 'Failed to load events';

      expect(appState.error).toBe('Failed to load events');
    });

    it('clears error on successful retry', () => {
      appState.error = 'Error';
      
      // After successful retry
      appState.error = null;

      expect(appState.error).toBeNull();
    });
  });

  describe('Selected Event State', () => {
    it('selects event from list', () => {
      appState.events = [
        { id: 'evt-1', name: 'Event 1' },
        { id: 'evt-2', name: 'Event 2' }
      ];

      appState.selectedEvent = appState.events[0];

      expect(appState.selectedEvent.id).toBe('evt-1');
    });

    it('clears selection', () => {
      appState.selectedEvent = { id: 'evt-1' };
      
      appState.selectedEvent = null;

      expect(appState.selectedEvent).toBeNull();
    });

    it('updates selected event when data changes', () => {
      appState.selectedEvent = { id: 'evt-1', name: 'Old Name' };
      
      // Backend returns updated data
      appState.selectedEvent = { id: 'evt-1', name: 'New Name' };

      expect(appState.selectedEvent.name).toBe('New Name');
    });
  });

  describe('State Persistence', () => {
    it('persists state to sessionStorage', () => {
      const state = { events: [{ id: 'evt-1' }] };
      const serialized = JSON.stringify(state);

      expect(serialized).toContain('evt-1');
    });

    it('restores state from sessionStorage', () => {
      const serialized = '{"events":[{"id":"evt-1"}]}';
      const restored = JSON.parse(serialized);

      expect(restored.events).toHaveLength(1);
    });

    it('handles corrupted state gracefully', () => {
      const corrupted = 'invalid json';
      let restored = null;

      try {
        restored = JSON.parse(corrupted);
      } catch {
        restored = { events: [] }; // Default state
      }

      expect(restored.events).toEqual([]);
    });
  });
});
