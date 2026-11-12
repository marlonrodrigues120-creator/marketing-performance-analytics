import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[MPA] erro de renderização', error)
  }
  render() {
    if (this.state.error)
      return (
        <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-bad" />
          <p className="font-medium">Algo deu errado ao carregar esta página.</p>
          <p className="mt-1 text-xs muted">{this.state.error.message}</p>
          <button className="btn-primary mt-4" onClick={() => this.setState({ error: null })}>Tentar novamente</button>
        </div>
      )
    return this.props.children
  }
}
