import { useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  return { toast, showToast };
}
