
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { useAppContext } from './store/AppContext';
import './App.css';

function App() {
  const { isLoaded } = useAppContext();

  if (!isLoaded) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading TeleShare...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <Canvas />
    </div>
  );
}

export default App;
