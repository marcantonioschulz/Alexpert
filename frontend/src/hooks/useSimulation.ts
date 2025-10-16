import { useCallback, useRef, useState } from 'react';
import { API_HEADERS } from '../utils/api';

type SimulationStatus = 'idle' | 'starting' | 'live' | 'ended' | 'error';
type SpeakerState = 'idle' | 'ai' | 'user';
type ScorePhase = 'idle' | 'loading' | 'ready' | 'error';
type TranscriptPhase = 'idle' | 'loading' | 'saving';

type ScoreResponse = {
  score: number;
  feedback: string;
};

type ConversationPayload = {
  id: string;
  transcript: string | null;
  score: number | null;
  feedback: string | null;
  createdAt: string;
};

export const useSimulation = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const aiSpeakingRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const idleTimeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [conversationDetails, setConversationDetails] = useState<ConversationPayload | null>(null);

  const cleanupMedia = useCallback(() => {
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    teardownRemoteTrackListenersRef.current?.();
    teardownRemoteTrackListenersRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    aiSpeakingRef.current = false;
    userSpeakingRef.current = false;
    updateSpeakerState('idle');
  }, [updateSpeakerState]);

  const startSimulation = useCallback(async () => {
    try {
      setError(null);
      setStatus('starting');
      setTranscript(null);
      setTranscriptDraft('');
      setScore(null);
      setScorePhase('idle');
      setTranscriptPhase('idle');
      updateSpeakerState('idle');

      const startResponse = await fetch('/api/start', {
        method: 'POST',
        headers: {
          ...(API_HEADERS ?? {})
        }
      });

      if (!startResponse.ok) {
        throw new Error('Konnte die Simulation nicht starten.');
      }

      const startPayload: { conversationId: string } = await startResponse.json();
      setConversationId(startPayload.conversationId);
      setConversationDetails((previous) =>
        previous?.id === startPayload.conversationId ? previous : null
      );

      const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        headers: {
          ...(API_HEADERS ?? {})
        }
      });

      if (!tokenResponse.ok) {
        throw new Error('Konnte kein Ephemeral Token erzeugen.');
      }

      const { token } = (await tokenResponse.json()) as { token: string };

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.addEventListener('track', (event) => {
        const [remoteStream] = event.streams;
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }

        teardownRemoteTrackListenersRef.current?.();
        const remoteTrack = event.track;
        teardownRemoteTrackListenersRef.current = attachRemoteTrackListeners(remoteTrack);
      });

      pc.addEventListener('datachannel', (event) => {
        const channel = event.channel;
        dataChannelRef.current = channel;
        channel.onmessage = (messageEvent) => {
          if (typeof messageEvent.data === 'string') {
            handleVadMessage(messageEvent.data);
          }
        };
      });

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({
          token,
          sdp: offer.sdp,
          conversationId: startPayload.conversationId
        })
      });

      if (!sdpResponse.ok) {
        throw new Error('Konnte keine Antwort vom Realtime-Service erhalten.');
      }

      const { sdp: remoteSdp } = (await sdpResponse.json()) as { sdp: string };
      await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });

      setStatus('live');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setStatus('error');
      cleanupMedia();
    }
  }, [attachRemoteTrackListeners, cleanupMedia, handleVadMessage, updateSpeakerState]);

  const endSimulation = useCallback(async () => {
    cleanupMedia();
    setStatus('ended');
  }, [cleanupMedia]);

  const saveTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setTranscriptPhase('saving');
      const response = await fetch(`/api/conversation/${conversationId}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({ transcript: transcriptDraft })
      });

    const payload = (await response.json()) as ConversationPayload;
    setTranscript(payload.transcript);
    setTranscriptDraft('');
    setConversationDetails(payload);
  }, [conversationId, transcriptDraft]);

  const fetchTranscript = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setTranscriptPhase('loading');
      const response = await fetch(`/api/conversation/${conversationId}`, {
        headers: {
          ...(API_HEADERS ?? {})
        }
      });
      if (!response.ok) {
        throw new Error('Transkript konnte nicht geladen werden.');
      }

    const payload = (await response.json()) as ConversationPayload;
    setTranscript(payload.transcript);
    setConversationDetails(payload);
    if (payload.score !== null && payload.feedback !== null) {
      setScore({ score: payload.score, feedback: payload.feedback });
    }
  }, [conversationId]);

  const requestScore = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setScorePhase('loading');
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_HEADERS ?? {})
        },
        body: JSON.stringify({ conversationId })
      });

      if (!response.ok) {
        throw new Error('Score konnte nicht berechnet werden.');
      }

    const payload = (await response.json()) as ScoreResponse & { conversationId: string };
    setScore({ score: payload.score, feedback: payload.feedback });
    setConversationDetails((previous) =>
      previous && previous.id === payload.conversationId
        ? { ...previous, score: payload.score, feedback: payload.feedback }
        : previous
    );
  }, [conversationId]);

  return {
    audioRef,
    conversationId,
    conversationDetails,
    endSimulation,
    error,
    fetchTranscript,
    scorePhase,
    speakerState,
    requestScore,
    saveTranscript,
    score,
    startSimulation,
    status,
    transcript,
    transcriptPhase,
    transcriptDraft,
    setTranscriptDraft
  };
};
