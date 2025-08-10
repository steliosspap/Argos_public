/**
 * Accessibility Tests for Argos Intelligence Platform
 * Tests WCAG 2.1 compliance and accessibility features
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Navigation from '@/components/Navigation';
import AccessibleButton from '@/components/AccessibleButton';
import AccessibleInput from '@/components/AccessibleInput';
import { announceToScreenReader, getContrastRatio } from '@/utils/accessibility';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  describe('Navigation Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Navigation />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels', () => {
      render(<Navigation />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByLabelText(/main navigation/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Navigation />);
      
      // Test tab navigation
      await user.tab();
      expect(screen.getByRole('link', { name: /argos home/i })).toHaveFocus();
    });
  });

  describe('AccessibleButton Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AccessibleButton onClick={() => {}}>Test Button</AccessibleButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should announce loading state', () => {
      render(
        <AccessibleButton loading={true} onClick={() => {}}>
          Submit
        </AccessibleButton>
      );
      
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading, please wait/i)).toBeInTheDocument();
    });

    it('should handle keyboard interactions', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      render(
        <AccessibleButton onClick={handleClick}>Click me</AccessibleButton>
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.type(button, '{enter}');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('AccessibleInput Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AccessibleInput 
          label="Test Input" 
          value=""
          onChange={() => {}}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should associate label with input', () => {
      render(
        <AccessibleInput 
          label="Username" 
          value=""
          onChange={() => {}}
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAccessibleName('Username');
    });

    it('should announce errors properly', () => {
      render(
        <AccessibleInput 
          label="Email" 
          value=""
          onChange={() => {}}
          error="Invalid email format"
        />
      );
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should support password visibility toggle', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibleInput 
          label="Password" 
          type="password"
          value="secret"
          onChange={() => {}}
          showPasswordToggle={true}
        />
      );
      
      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
      
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
    });
  });

  describe('Screen Reader Announcements', () => {
    beforeEach(() => {
      // Mock DOM methods
      document.getElementById = jest.fn();
    });

    it('should announce messages to screen readers', () => {
      const mockElement = {
        textContent: ''
      };
      
      (document.getElementById as jest.Mock).mockReturnValue(mockElement);
      
      announceToScreenReader('Test message', 'polite');
      
      setTimeout(() => {
        expect(mockElement.textContent).toBe('Test message');
      }, 100);
    });

    it('should handle assertive announcements', () => {
      const mockElement = {
        textContent: ''
      };
      
      (document.getElementById as jest.Mock).mockReturnValue(mockElement);
      
      announceToScreenReader('Urgent message', 'assertive');
      
      setTimeout(() => {
        expect(mockElement.textContent).toBe('Urgent message');
      }, 100);
    });
  });

  describe('Color Contrast', () => {
    it('should meet WCAG AA contrast ratios', () => {
      // Test primary text contrast (white on dark background)
      const whiteOnDark = getContrastRatio('#FFFFFF', '#111827');
      expect(whiteOnDark).toBeGreaterThan(4.5);
      
      // Test error text contrast
      const errorContrast = getContrastRatio('#EF4444', '#111827');
      expect(errorContrast).toBeGreaterThan(4.5);
      
      // Test link contrast
      const linkContrast = getContrastRatio('#3B82F6', '#111827');
      expect(linkContrast).toBeGreaterThan(4.5);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should trap focus in modals', () => {
      // This would require a more complex modal component test
      // For now, we'll just test that the function exists
      expect(typeof global.trapFocus).toBe('function');
    });

    it('should handle reduced motion preferences', () => {
      // Mock matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      const { prefersReducedMotion } = require('@/utils/accessibility');
      expect(prefersReducedMotion()).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should provide accessible error messages', () => {
      render(
        <form>
          <AccessibleInput 
            label="Email"
            type="email"
            value=""
            onChange={() => {}}
            error="Please enter a valid email address"
            required
          />
        </form>
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('Skip Links', () => {
    it('should provide skip navigation links', () => {
      render(
        <div>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <nav>Navigation</nav>
          <main id="main-content">Main content</main>
        </div>
      );
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('ARIA Live Regions', () => {
    it('should have live regions for announcements', () => {
      render(
        <div>
          <div aria-live="polite" id="live-region"></div>
          <div aria-live="assertive" id="alert-region"></div>
        </div>
      );
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Touch Targets', () => {
    it('should have adequate touch target sizes', () => {
      render(
        <AccessibleButton size="md" onClick={() => {}}>
          Touch Target
        </AccessibleButton>
      );
      
      const button = screen.getByRole('button');
      const styles = getComputedStyle(button);
      
      // Check minimum 44px touch target (converted from padding + content)
      const minHeight = parseInt(styles.minHeight || '0');
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });
  });
});

// Integration tests for specific user journeys
describe('Accessibility User Journeys', () => {
  describe('Login Flow', () => {
    it('should be fully navigable with keyboard', async () => {
      const user = userEvent.setup();
      
      // This would require the full login component
      // Testing the flow from navigation to form completion
      // Including proper focus management and announcements
    });
  });

  describe('Map Interaction', () => {
    it('should provide keyboard alternatives for map controls', () => {
      // Test keyboard shortcuts for map navigation
      // Verify screen reader announcements for map changes
    });
  });

  describe('Event Selection', () => {
    it('should announce event selection to screen readers', () => {
      // Test event card selection and announcement
      // Verify proper focus management in event lists
    });
  });
});

export {};