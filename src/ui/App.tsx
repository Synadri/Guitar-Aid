import './styles/global.css';
import styles from './App.module.css';
import { AppShell } from './shell';

export function App() {
  return (
    <main className={styles.app}>
      <AppShell />
    </main>
  );
}
