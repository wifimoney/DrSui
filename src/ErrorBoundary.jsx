import React from 'react';

/**
 * ErrorBoundary Component
 * 
 * A React Error Boundary class component that catches JavaScript errors
 * anywhere in the child component tree and displays a fallback UI.
 * 
 * Error Boundaries:
 * - Catch errors during rendering, lifecycle methods, and constructors
 * - Do NOT catch errors in event handlers, async code, or server-side rendering
 * - Must be a class component (functional components cannot be error boundaries)
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    // State to track if an error has occurred
    this.state = {
      hasError: false,        // Boolean flag indicating if error occurred
      error: null,            // The Error object that was caught
      errorInfo: null,        // Additional error information (stack trace, etc.)
    };
  }

  /**
   * getDerivedStateFromError
   * 
   * Static lifecycle method that is called when an error is thrown in a child component.
   * It receives the error that was thrown and returns an object to update state.
   * 
   * This method is used to render the fallback UI after an error has been thrown.
   */
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error,
    };
  }

  /**
   * componentDidCatch
   * 
   * Lifecycle method called after an error has been thrown by a descendant component.
   * It receives the error and an info object containing component stack trace.
   * 
   * This method is useful for logging errors to error reporting services.
   */
  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info for display
    this.setState({
      errorInfo: errorInfo,
    });

    // TODO: Here you could log the error to an error reporting service like:
    // - Sentry
    // - LogRocket
    // - Bugsnag
    // Example: logErrorToService(error, errorInfo);
  }

  /**
   * handleReset
   * 
   * Resets the error boundary state to allow the user to try again.
   * This will re-render the children components.
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * handleReload
   * 
   * Reloads the entire page to get a fresh start.
   * Useful when the error state might persist in memory.
   */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    // If there's an error, render the fallback UI
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Error Icon and Main Message */}
            <div style={styles.header}>
              <div style={styles.iconContainer}>
                <span style={styles.icon}>⚠️</span>
              </div>
              <h1 style={styles.title}>Something went wrong</h1>
              <p style={styles.message}>
                We're sorry, but something unexpected happened. 
                Please try again or refresh the page.
              </p>
            </div>

            {/* Error Details (Collapsible) */}
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>
                  Technical Details (Click to expand)
                </summary>
                <div style={styles.errorDetails}>
                  <div style={styles.errorSection}>
                    <strong style={styles.errorLabel}>Error:</strong>
                    <pre style={styles.errorText}>
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  
                  {this.state.errorInfo && (
                    <div style={styles.errorSection}>
                      <strong style={styles.errorLabel}>Component Stack:</strong>
                      <pre style={styles.errorText}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  
                  {this.state.error.stack && (
                    <div style={styles.errorSection}>
                      <strong style={styles.errorLabel}>Stack Trace:</strong>
                      <pre style={styles.errorText}>
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div style={styles.buttonContainer}>
              <button
                onClick={this.handleReset}
                style={styles.primaryButton}
                onMouseEnter={(e) => {
                  Object.assign(e.target.style, buttonHoverStyle);
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = 'none';
                }}
              >
                🔄 Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={styles.secondaryButton}
                onMouseEnter={(e) => {
                  Object.assign(e.target.style, buttonHoverStyle);
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = 'none';
                }}
              >
                🔃 Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

/**
 * Styling Object
 * 
 * Inline styles for the error boundary UI.
 * Uses red accent color for error indication and centered card layout.
 */
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    border: '2px solid #ef4444', // Red border for error indication
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  iconContainer: {
    marginBottom: '16px',
  },
  icon: {
    fontSize: '64px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '12px',
  },
  message: {
    fontSize: '16px',
    color: '#64748b',
    lineHeight: '1.6',
  },
  details: {
    marginTop: '24px',
    marginBottom: '24px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  summary: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    fontWeight: '600',
    color: '#374151',
    userSelect: 'none',
    borderBottom: '1px solid #e5e7eb',
  },
  errorDetails: {
    padding: '16px',
    backgroundColor: '#fef2f2', // Light red background
    maxHeight: '400px',
    overflowY: 'auto',
  },
  errorSection: {
    marginBottom: '16px',
  },
  errorLabel: {
    display: 'block',
    marginBottom: '8px',
    color: '#dc2626', // Red color for error labels
    fontSize: '14px',
  },
  errorText: {
    fontSize: '12px',
    fontFamily: 'monospace',
    backgroundColor: '#ffffff',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #fecaca',
    color: '#991b1b',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    lineHeight: '1.5',
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '24px',
  },
  primaryButton: {
    backgroundColor: '#ef4444', // Red accent color
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  secondaryButton: {
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// Add hover effects using event handlers (inline styles don't support :hover)
const buttonHoverStyle = {
  transform: 'translateY(-1px)',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
};

export default ErrorBoundary;

