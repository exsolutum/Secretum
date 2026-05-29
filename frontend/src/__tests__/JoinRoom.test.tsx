import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JoinRoom } from '../components/JoinRoom';

describe('JoinRoom', () => {
  it('renders the SECRETUM title', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error={null} />);
    expect(screen.getByText('SECRETUM')).toBeDefined();
  });

  it('renders input fields with Chinese labels', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error={null} />);
    expect(screen.getByPlaceholderText('输入你的昵称')).toBeDefined();
    expect(screen.getByPlaceholderText('输入或创建房间号')).toBeDefined();
  });

  it('shows error when provided', () => {
    render(<JoinRoom onJoin={() => {}} connectionState="disconnected" error="测试错误" />);
    expect(screen.getByText('测试错误')).toBeDefined();
  });
});
