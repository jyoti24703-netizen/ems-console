import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AppErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-4">
          <div className="max-w-xl w-full bg-[#1f2937] border border-red-800 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-red-300">Application Error</h1>
            <p className="text-sm text-gray-300 mt-2">
              Something unexpected happened. The error has been logged for review.
            </p>
            <pre className="mt-3 text-xs text-gray-400 bg-[#111827] border border-gray-700 rounded p-3 overflow-auto">
              {String(this.state.error?.message || "Unknown error")}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
