import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SessionExpiredModal from './SessionExpiredModal';
import {
  DEFAULT_SESSION_EXPIRED_MESSAGE,
  onSessionExpired,
} from '../services/sessionExpired';

export default function SessionExpiredHost() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_SESSION_EXPIRED_MESSAGE);

  useEffect(
    () =>
      onSessionExpired((msg) => {
        setMessage(msg);
        setOpen(true);
      }),
    [],
  );

  const goLogin = useCallback(() => {
    setOpen(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  return <SessionExpiredModal open={open} message={message} onLogin={goLogin} />;
}
