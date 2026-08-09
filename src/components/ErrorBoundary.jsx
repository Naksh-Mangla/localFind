import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('LocalFind Application Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-center">
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-variant shadow-xl max-w-md w-full animate-popIn">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h2 className="font-headline-lg text-xl font-bold text-on-surface mb-2">Something went wrong</h2>
            <p className="text-xs text-on-surface-variant mb-6">
              An unexpected display issue occurred. Tap below to refresh the application.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 px-6 rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              Refresh Application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
