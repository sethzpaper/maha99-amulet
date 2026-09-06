import { useEffect, useState } from 'react';
import { todayBangkok } from './workflow';
export function useWorkDate() {
  const [today, setToday] = useState(todayBangkok);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayBangkok()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}
