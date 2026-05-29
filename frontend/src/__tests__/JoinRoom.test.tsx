import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JoinRoom } from '../components/JoinRoom';

describe('JoinRoom', () => {
  it('renders the SECRETUM title', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error={null} />);
    expect(screen.getByText('SECRETUM')).toBeDefined();
  });

  it('renders input fields', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error={null} />);
    expect(screen.getByPlaceholderText('Your nickname')).toBeDefined();
    expect(screen.getByPlaceholderText('Room identifier')).toBeDefined();
  });

  it('shows error when provided', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error="Test error" />);
    expect(screen.getByText('Test error')).toBeDefined();
  });
});
