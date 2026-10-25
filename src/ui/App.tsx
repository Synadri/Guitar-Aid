import './styles/global.css';
import styles from './App.module.css';
import { SandboxView } from './sandbox';

export function App() {
  return (
    <main className={styles.app}>
      <SandboxView />
    </main>
  );
}
