import styles from './App.module.css';
import { Gallery } from './dev/Gallery';

export function App() {
  return (
    <main className={styles.app}>
      <Gallery />
    </main>
  );
}
