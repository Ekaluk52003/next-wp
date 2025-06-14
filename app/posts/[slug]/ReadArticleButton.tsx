"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { VolumeIcon, PauseIcon, PlayIcon, HeadphonesIcon, Settings2Icon, XCircleIcon } from "lucide-react";

export default function ReadArticleButton({ content }: { content: string }) {
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [currentText, setCurrentText] = useState<string>("");
  const [highlightedText, setHighlightedText] = useState<string>("");
  const [showTextCapture, setShowTextCapture] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [readingSpeed, setReadingSpeed] = useState(1);
  const [enableBackgroundMusic, setEnableBackgroundMusic] = useState(false);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasThaiVoice, setHasThaiVoice] = useState(false);
  const [currentWordPosition, setCurrentWordPosition] = useState<{charIndex: number, charLength: number} | null>(null);
  const [currentReadingPosition, setCurrentReadingPosition] = useState<number>(0);
  const [enableAutoScroll, setEnableAutoScroll] = useState(true);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);

  // Clean HTML content to get plain text
  const getPlainText = (html: string) => {
    if (typeof window === 'undefined') return "";
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };
  
  // Find the article element in the DOM
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const article = document.querySelector('article');
      if (article) {
        articleRef.current = article as HTMLElement;
      }
    }
  }, []);

  // Initialize background music
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio('/ambient-music.mp3');
      audio.loop = true;
      audio.volume = backgroundMusicVolume;
      backgroundMusicRef.current = audio;
      
      // Handle audio loading errors
      audio.onerror = () => {
        console.error('Failed to load background music');
        setEnableBackgroundMusic(false);
      };
    }
    
    return () => {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
      }
    };
  }, []);
  
  // Update background music volume when it changes
  useEffect(() => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = backgroundMusicVolume;
    }
  }, [backgroundMusicVolume]);

  // Handle background music toggle
  useEffect(() => {
    if (!backgroundMusicRef.current) return;
    
    if (enableBackgroundMusic && isReading) {
      backgroundMusicRef.current.play().catch(error => {
        console.error('Failed to play background music:', error);
        setEnableBackgroundMusic(false);
      });
    } else {
      backgroundMusicRef.current.pause();
    }
  }, [enableBackgroundMusic, isReading]);

  useEffect(() => {
    // Initialize speech synthesis
    if (typeof window !== 'undefined') {
      const synth = window.speechSynthesis;
      const plainText = getPlainText(content);
      const u = new SpeechSynthesisUtterance(plainText);
      
      // Set initial text
      setCurrentText(plainText);
      
      // Configure voice settings for a smoother, female voice
      // First load voices
      let voices: SpeechSynthesisVoice[] = [];
      
      const loadVoices = () => {
        voices = synth.getVoices();
        setAvailableVoices(voices);
        
        // Try to find Thai voice or female voice
        const thaiVoices = voices.filter(voice => 
          voice.name.includes('Thai') || 
          voice.lang === 'th-TH' ||
          voice.name.includes('Google ไทย') ||
          voice.name.includes('Google Thai') ||
          voice.name.includes('Niwat') ||
          voice.name.includes('Narisa')
        );
        
        // Log all available voices for debugging
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
        
        // Check if we have any Thai voices
        if (thaiVoices.length > 0) {
          setHasThaiVoice(true);
          console.log('Found Thai voices:', thaiVoices.map(v => v.name));
          
          // Use the first Thai voice
          const thaiVoiceIndex = voices.indexOf(thaiVoices[0]);
          setSelectedVoiceIndex(thaiVoiceIndex);
          u.voice = voices[thaiVoiceIndex];
        } else {
          setHasThaiVoice(false);
          console.log('No Thai voices found');
          
          // Try to find a female voice instead
          const femaleVoiceIndex = voices.findIndex(voice => 
            voice.name.toLowerCase().includes('female') || 
            voice.name.includes('Google UK English Female') ||
            voice.name.includes('Microsoft Zira')
          );
          
          if (femaleVoiceIndex !== -1) {
            setSelectedVoiceIndex(femaleVoiceIndex);
            u.voice = voices[femaleVoiceIndex];
          }
        }
        
        // Adjust speech parameters for smoother sound
        u.rate = readingSpeed; // Use reading speed state
        u.pitch = 1.05; // Slightly higher pitch
        u.volume = 1.0; // Full volume
      };
      
      // Load voices
      if (synth.getVoices().length > 0) {
        loadVoices();
      } else {
        synth.onvoiceschanged = loadVoices;
      }
      
      // Add event listeners for text tracking
      u.onboundary = (event) => {
        if (event.name === 'word') {
          const plainText = getPlainText(content);
          const currentPosition = event.charIndex;
          const wordLength = event.charLength || 5;
          const currentWord = plainText.substring(currentPosition, currentPosition + wordLength);
          
          // Store current position for voice/rate changes and highlighting
          setCurrentReadingPosition(currentPosition);
          setCurrentWordPosition({
            charIndex: currentPosition,
            charLength: wordLength
          });
          
          // Get some context around the current word for highlighting
          const startContext = Math.max(0, currentPosition - 20);
          const endContext = Math.min(plainText.length, currentPosition + wordLength + 20);
          const textContext = plainText.substring(startContext, endContext);
          
          setHighlightedText(textContext);
          
          // Auto-scroll to the current word if enabled
          if (enableAutoScroll && articleRef.current) {
            highlightAndScrollToText(currentWord, plainText, currentPosition);
          }
        }
      };
      
      // Function to find and highlight text in the article
      const highlightAndScrollToText = (word: string, fullText: string, position: number) => {
        if (!articleRef.current) return;
        
        // Get all text nodes in the article
        const textNodes: Node[] = [];
        const walker = document.createTreeWalker(
          articleRef.current,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        // Try to find the node containing our text
        let targetNode: Node | null = null;
        let targetOffset = 0;
        let cumulativeLength = 0;
        
        // Calculate approximate position in the DOM
        const relativePosition = position / fullText.length;
        const approximateNodeIndex = Math.floor(relativePosition * textNodes.length);
        
        // Start searching from the approximate position
        const startIndex = Math.max(0, approximateNodeIndex - 5);
        const endIndex = Math.min(textNodes.length, approximateNodeIndex + 15);
        
        for (let i = startIndex; i < endIndex; i++) {
          const nodeText = textNodes[i].textContent || "";
          if (nodeText.includes(word)) {
            targetNode = textNodes[i];
            targetOffset = nodeText.indexOf(word);
            break;
          }
        }
        
        if (targetNode && targetNode.parentElement) {
          // Create a range to select the text
          const range = document.createRange();
          range.setStart(targetNode, targetOffset);
          range.setEnd(targetNode, targetOffset + word.length);
          
          // Clear any existing selection
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
          
          // Scroll the element into view with smooth behavior
          targetNode.parentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      };
      
      setUtterance(u);

      // Handle speech end
      u.onend = () => {
        setIsReading(false);
        setIsPaused(false);
        setHighlightedText("");
        setShowTextCapture(false);
      };

      return () => {
        synth.cancel();
      };
    }
  }, [content]);
  
  // Refs for tracking previous values to prevent infinite loops
  const prevVoiceIndexRef = useRef(selectedVoiceIndex);
  const prevSpeedRef = useRef(readingSpeed);
  
  // Update voice when selection changes
  useEffect(() => {
    if (!utterance || !availableVoices.length || !isReading) return;
    
    // Only update if the voice selection actually changed
    if (prevVoiceIndexRef.current === selectedVoiceIndex) return;
    
    const selectedVoice = availableVoices[selectedVoiceIndex];
    if (selectedVoice) {
      // Create a new utterance with the same text but different voice
      const synth = window.speechSynthesis;
      const text = utterance.text;
      
      // Cancel current speech
      synth.cancel();
      
      // Create new utterance starting from current position
      const newUtterance = new SpeechSynthesisUtterance(
        text.substring(currentReadingPosition)
      );
      
      // Copy properties
      newUtterance.voice = selectedVoice;
      newUtterance.rate = utterance.rate;
      newUtterance.onboundary = utterance.onboundary;
      newUtterance.onend = utterance.onend;
      
      // Update current utterance
      setUtterance(newUtterance);
      
      // Speak with new voice
      if (!isPaused) {
        synth.speak(newUtterance);
      }
      
      // Update the previous voice index
      prevVoiceIndexRef.current = selectedVoiceIndex;
    }
  }, [selectedVoiceIndex, availableVoices, isReading, utterance, isPaused, currentReadingPosition]);

  // Update rate when reading speed changes
  useEffect(() => {
    if (!utterance || !isReading) return;
    
    // Only update if the speed actually changed
    if (prevSpeedRef.current === readingSpeed) return;
    
    // Create a new utterance with updated rate
    const synth = window.speechSynthesis;
    const text = utterance.text;
    
    // Cancel current speech
    synth.cancel();
    
    // Create new utterance starting from current position
    const newUtterance = new SpeechSynthesisUtterance(
      text.substring(currentReadingPosition)
    );
    
    // Copy properties but update rate
    newUtterance.voice = utterance.voice;
    newUtterance.rate = readingSpeed;
    newUtterance.onboundary = utterance.onboundary;
    newUtterance.onend = utterance.onend;
    
    // Update current utterance
    setUtterance(newUtterance);
    
    // Speak with new rate
    if (!isPaused) {
      synth.speak(newUtterance);
    }
    
    // Update the previous speed
    prevSpeedRef.current = readingSpeed;
  }, [readingSpeed, utterance, isReading, isPaused, currentReadingPosition]);

  const toggleReading = () => {
    if (typeof window === 'undefined') return;
    
    const synth = window.speechSynthesis;
    
    if (isReading) {
      // Pause/Resume reading
      if (isPaused) {
        synth.resume();
        
        // Resume background music if enabled
        if (enableBackgroundMusic && backgroundMusicRef.current) {
          backgroundMusicRef.current.play().catch(console.error);
        }
      } else {
        synth.pause();
        
        // Pause background music if enabled
        if (enableBackgroundMusic && backgroundMusicRef.current) {
          backgroundMusicRef.current.pause();
        }
      }
      setIsPaused(!isPaused);
    } else {
      // Start new reading
      const plainText = getPlainText(content);
      const u = new SpeechSynthesisUtterance(plainText);
      
      // Set voice if available
      if (availableVoices.length > 0) {
        const selectedVoice = availableVoices[selectedVoiceIndex];
        u.voice = selectedVoice;
        
        // Check if content is Thai but voice is not Thai
        const contentHasThai = /[\u0E00-\u0E7F]/.test(plainText);
        const voiceIsThai = selectedVoice.lang === 'th-TH' || 
                          selectedVoice.name.includes('Thai') ||
                          selectedVoice.name.includes('ไทย') ||
                          selectedVoice.name.includes('Niwat') ||
                          selectedVoice.name.includes('Narisa');
        
        if (contentHasThai && !voiceIsThai && hasThaiVoice) {
          setErrorMessage("Warning: Thai text detected but non-Thai voice selected. Consider switching to a Thai voice for better pronunciation.");
        } else if (contentHasThai && !hasThaiVoice) {
          setErrorMessage("Warning: Thai text detected but no Thai voices available. Install Thai voices for better pronunciation.");
        } else {
          setErrorMessage("");
        }
      }
      
      // Set rate (speed)
      u.rate = readingSpeed;
      
      // Copy event handlers from the previous utterance
      if (utterance) {
        u.onboundary = utterance.onboundary;
        u.onend = utterance.onend;
      }
      
      setUtterance(u);
      synth.cancel(); // Cancel any ongoing speech
      synth.speak(u);
      setIsReading(true);
      setIsPaused(false);
      setShowTextCapture(true);
      
      // Play background music if enabled
      if (enableBackgroundMusic && backgroundMusicRef.current) {
        backgroundMusicRef.current.currentTime = 0;
        backgroundMusicRef.current.play().catch(console.error);
      }
    }
  };

// ... (rest of the code remains the same)
  const stopReading = () => {
    if (typeof window === 'undefined') return;
    
    const synth = window.speechSynthesis;
    synth.cancel();
    setIsReading(false);
    setIsPaused(false);
    setHighlightedText("");
    setShowTextCapture(false);
    
    // Stop background music
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
  };

  // Floating stop button that appears when reading
  const FloatingStopButton = () => {
    if (!isReading) return null;
    
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={stopReading}
          className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition-all duration-300"
          aria-label="Stop Reading"
          title="Stop Reading"
        >
          <XCircleIcon size={24} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Floating stop button */}
      <FloatingStopButton />
      
      <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <HeadphonesIcon size={20} className="text-purple-500" />
          <h3 className="text-lg font-medium">Listen to Article</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Background Music</label>
            <input 
              type="checkbox" 
              checked={enableBackgroundMusic}
              onChange={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Auto-scroll</label>
            <input 
              type="checkbox" 
              checked={enableAutoScroll}
              onChange={() => setEnableAutoScroll(!enableAutoScroll)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      {errorMessage && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-3">
          <p className="text-sm text-yellow-700">{errorMessage}</p>
        </div>
      )}
      
      {!hasThaiVoice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
          <div className="text-sm text-blue-700">
            No Thai voices detected in your browser. To add Thai voices:
            <ul className="list-disc pl-5 mt-1">
              <li>In Windows: Settings → Time & Language → Language → Add Thai language</li>
              <li>In macOS: System Preferences → Accessibility → Spoken Content → Add Thai voice</li>
              <li>In Chrome: chrome://settings/languages → Add Thai language</li>
            </ul>
          </div>
        </div>
      )}
      
      <div className="flex flex-col gap-3 w-full">
        <div className="w-full">
          <label className="block text-sm font-medium mb-1">Voice</label>
          <select
            value={selectedVoiceIndex}
            onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {availableVoices.map((voice, index) => (
              <option key={`${voice.name}-${index}`} value={index}>
                {voice.name} ({voice.lang})
                {(voice.lang === 'th-TH' || 
                  voice.name.includes('Thai') || 
                  voice.name.includes('ไทย') ||
                  voice.name.includes('Niwat') ||
                  voice.name.includes('Narisa')) ? ' ★ (Thai)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div className="w-full">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium">Reading Speed</label>
            <span className="text-sm text-gray-500">{readingSpeed.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs">0.5x</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={readingSpeed}
              onChange={(e) => setReadingSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs">2.0x</span>
          </div>
        </div>
        
        {enableBackgroundMusic && (
          <div className="w-full">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium">Background Music Volume</label>
              <span className="text-sm text-gray-500">{Math.round(backgroundMusicVolume * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs">0%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={backgroundMusicVolume}
                onChange={(e) => setBackgroundMusicVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs">100%</span>
            </div>
          </div>
        )}
        
        <div className="flex gap-3 items-center">
          <Button 
            onClick={toggleReading} 
            variant={isReading ? "default" : "secondary"}
            className={`flex gap-2 items-center shadow-md transition-all duration-300 ${isReading ? '' : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white'}`}
            size="lg"
          >
            {isReading ? (
              isPaused ? <PlayIcon size={18} /> : <PauseIcon size={18} />
            ) : (
              <VolumeIcon size={18} />
            )}
            {isReading 
              ? (isPaused ? "Resume Reading" : "Pause Reading") 
              : "Listen to Article"}
          </Button>
          {isReading && (
            <Button 
              onClick={stopReading} 
              variant="destructive"
              size="lg"
              className="shadow-md"
            >
              Stop
            </Button>
          )}
        </div>
      </div>     
    
    
    </div>
    </>
  );
}
