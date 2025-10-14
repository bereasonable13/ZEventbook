import React from 'react';
// Example Unit Test - Component Testing
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock component for demonstration
const EventCard = ({ title, date, attendees }) => (
  <div data-testid="event-card">
    <h2>{title}</h2>
    <p>Date: {date}</p>
    <p>Attendees: {attendees}</p>
  </div>
);

describe('EventCard Component', () => {
  it('renders event information correctly', () => {
    render(
      <EventCard 
        title="Tech Meetup" 
        date="2025-10-15" 
        attendees={25} 
      />
    );

    expect(screen.getByText('Tech Meetup')).toBeInTheDocument();
    expect(screen.getByText(/Date: 2025-10-15/)).toBeInTheDocument();
    expect(screen.getByText(/Attendees: 25/)).toBeInTheDocument();
  });

  it('handles missing attendees gracefully', () => {
    render(
      <EventCard 
        title="Tech Meetup" 
        date="2025-10-15" 
        attendees={0} 
      />
    );

    expect(screen.getByText(/Attendees: 0/)).toBeInTheDocument();
  });

  it('renders with proper test id', () => {
    render(
      <EventCard 
        title="Tech Meetup" 
        date="2025-10-15" 
        attendees={25} 
      />
    );

    expect(screen.getByTestId('event-card')).toBeInTheDocument();
  });
});

// Example: Testing utility functions
describe('Date Utilities', () => {
  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  it('formats dates correctly', () => {
    expect(formatEventDate('2025-10-15')).toBe('October 15, 2025');
  });

  it('handles invalid dates', () => {
    expect(formatEventDate('invalid')).toBe('Invalid Date');
  });
});

// Example: Testing custom hooks
describe('useEventForm Hook', () => {
  const useEventForm = (initialValues) => {
    const [values, setValues] = React.useState(initialValues);
    const [errors, setErrors] = React.useState({});

    const validate = () => {
      const newErrors = {};
      if (!values.title) newErrors.title = 'Title is required';
      if (!values.date) newErrors.date = 'Date is required';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    return { values, setValues, errors, validate };
  };

  // Hook testing would use @testing-library/react-hooks
  // This is a simplified example
  it('validates required fields', () => {
    const initialValues = { title: '', date: '' };
    // In real test, would use renderHook from @testing-library/react-hooks
  });
});
