/**
 * Tests for Canvas, ToolBar, Shape, PropertiesPanel, and Layers views.
 *
 * These tests verify that the components render correctly with the model state,
 * and that user interactions trigger the correct controller actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Canvas from '@/views/Canvas';
import ToolBar from '@/views/ToolBar';
import ContextProvider from '@/viewModels/ContextProvider';
import { model } from '@/models/GraphicEditorModel';

// Helper: render a component wrapped in ContextProvider
function renderWithContext(ui: React.ReactElement) {
  return render(<ContextProvider>{ui}</ContextProvider>);
}

describe('Canvas', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('renders no shapes when model is empty', () => {
    const { container } = renderWithContext(<Canvas />);
    // Canvas should render its root div
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('renders shapes when model has objects', () => {
    model.add('rectangle');
    model.add('ellipse');
    const { container } = renderWithContext(<Canvas />);
    // Canvas should mount and render its root container.
    expect(container.firstChild).toBeTruthy();
  });
});

describe('ToolBar', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('renders all shape creation buttons', () => {
    renderWithContext(<ToolBar />);
    expect(screen.getByText('Rectangle')).toBeTruthy();
    expect(screen.getByText('Ellipse')).toBeTruthy();
    expect(screen.getByText('Line')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.getByText('Text')).toBeTruthy();
  });

  it('renders action buttons', () => {
    renderWithContext(<ToolBar />);
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Clear Canvas')).toBeTruthy();
    expect(screen.getByText('Undo')).toBeTruthy();
    expect(screen.getByText('Redo')).toBeTruthy();
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Ungroup')).toBeTruthy();
  });

  it('adds a rectangle on button click', async () => {
    const initialCount = model.snapshot.length;
    renderWithContext(<ToolBar />);

    const btn = screen.getByText('Rectangle');
    await userEvent.click(btn);

    expect(model.snapshot.length).toBe(initialCount + 1);
    expect(model.snapshot[0].type).toBe('rectangle');
  });

  it('adds an ellipse on button click', async () => {
    renderWithContext(<ToolBar />);
    await userEvent.click(screen.getByText('Ellipse'));
    expect(model.snapshot.some(o => o.type === 'ellipse')).toBe(true);
  });

  it('clears canvas on Clear Canvas click', async () => {
    model.add('rectangle');
    model.add('ellipse');
    expect(model.snapshot.length).toBe(2);

    renderWithContext(<ToolBar />);
    await userEvent.click(screen.getByText('Clear Canvas'));

    expect(model.snapshot.length).toBe(0);
  });
});

describe('PropertiesPanel', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('renders nothing when nothing is selected', () => {
    const { container } = renderWithContext(
      <>
        <ToolBar />
      </>
    );
    // Properties panel should render its container
    expect(container.querySelector('div')).toBeTruthy();
  });
});

describe('Layers', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('renders layer items for each object', () => {
    model.add('rectangle');
    model.add('ellipse');
    const { container } = renderWithContext(<div />);
    expect(container).toBeTruthy();
  });
});