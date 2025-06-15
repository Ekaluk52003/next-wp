"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { VolumeIcon, PauseIcon, PlayIcon, HeadphonesIcon, Settings2Icon } from "lucide-react";

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
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  // Clean HTML content to get plain text
  const getPlainText = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

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
          
          // Store current position for voice/rate changes
          u.currentPosition = currentPosition;
          
          // Get some context around the current word for highlighting
          const startContext = Math.max(0, currentPosition - 20);
          const endContext = Math.min(plainText.length, currentPosition + wordLength + 20);
          const textContext = plainText.substring(startContext, endContext);
          
          setHighlightedText(textContext);
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

  // Update voice when selection changes
  useEffect(() => {
    if (!utterance || availableVoices.length === 0) return;
    
    // If we're currently reading, we need to maintain the current position
    if (isReading) {
      const synth = window.speechSynthesis;
      const currentPosition = utterance.currentPosition || 0;
      
      // Create a new utterance with the selected voice
      const plainText = getPlainText(content);
      const newUtterance = new SpeechSynthesisUtterance(plainText);
      newUtterance.voice = availableVoices[selectedVoiceIndex];
      newUtterance.rate = readingSpeed;
      newUtterance.pitch = utterance.pitch;
      newUtterance.volume = utterance.volume;
      
      // Copy all event handlers
      newUtterance.onstart = utterance.onstart;
      newUtterance.onpause = utterance.onpause;
      newUtterance.onresume = utterance.onresume;
      newUtterance.onend = utterance.onend;
      newUtterance.onboundary = utterance.onboundary;
      
      // Cancel current speech and start from current position
      synth.cancel();
      
      // Set the text to the remaining portion
      if (currentPosition > 0) {
        newUtterance.text = plainText.substring(currentPosition);
      }
      
      // Update the utterance and speak
      setUtterance(newUtterance);
      synth.speak(newUtterance);
    } else {
      // If not reading, just update the voice
      utterance.voice = availableVoices[selectedVoiceIndex];
    }
  }, [selectedVoiceIndex, availableVoices, isReading, content]);
  
  // Update rate when reading speed changes
  useEffect(() => {
    if (!utterance) return;
    
    if (isReading) {
      // Store current position before changing rate
      const currentPosition = utterance.currentPosition || 0;
      const synth = window.speechSynthesis;
      
      // Create a new utterance with updated rate
      const plainText = getPlainText(content);
      const newUtterance = new SpeechSynthesisUtterance(plainText);
      newUtterance.voice = utterance.voice;
      newUtterance.rate = readingSpeed;
      newUtterance.pitch = utterance.pitch;
      newUtterance.volume = utterance.volume;
      
      // Copy all event handlers
      newUtterance.onstart = utterance.onstart;
      newUtterance.onpause = utterance.onpause;
      newUtterance.onresume = utterance.onresume;
      newUtterance.onend = utterance.onend;
      newUtterance.onboundary = utterance.onboundary;
      
      // Cancel current speech and start from current position
      synth.cancel();
      
      // Set the text to the remaining portion
      if (currentPosition > 0) {
        newUtterance.text = plainText.substring(currentPosition);
      }
      
      // Update the utterance and speak
      setUtterance(newUtterance);
      synth.speak(newUtterance);
    } else {
      // If not reading, just update the rate
      utterance.rate = readingSpeed;
    }
  }, [readingSpeed, isReading, content]);

  const toggleReading = () => {
    if (typeof window === 'undefined' || !utterance) return;
    
    // Clear any previous error messages
    setErrorMessage("");
    
    const synth = window.speechSynthesis;
    
    // Check if the selected voice is available and compatible
    if (!isReading && availableVoices.length > 0) {
      const selectedVoice = availableVoices[selectedVoiceIndex];
      
      // Check if the voice is working properly
      try {
        // Test if the voice can speak a simple phrase
        const testUtterance = new SpeechSynthesisUtterance("Test");
        testUtterance.voice = selectedVoice;
        
        // If the user wants Thai but we don't have Thai voice
        if (selectedVoice.lang !== 'th-TH' && !selectedVoice.name.includes('Thai') && 
            !hasThaiVoice && content.match(/[\u0E00-\u0E7F]/)) {
          setErrorMessage("Warning: Thai text detected but no Thai voice is available. Text may not be pronounced correctly.");
        }
      } catch (error) {
        console.error('Voice compatibility error:', error);
        setErrorMessage("Error: The selected voice is not compatible with your browser.");
        return;
      }
    }

    if (isReading) {
      if (isPaused) {
        synth.resume();
        setIsPaused(false);
        
        // Resume background music if enabled
        if (enableBackgroundMusic && backgroundMusicRef.current) {
          backgroundMusicRef.current.play().catch(error => {
            console.error('Failed to play background music:', error);
            setEnableBackgroundMusic(false);
          });
        }
      } else {
        synth.pause();
        setIsPaused(true);
        
        // Pause background music if enabled
        if (enableBackgroundMusic && backgroundMusicRef.current) {
          backgroundMusicRef.current.pause();
        }
      }
    } else {
      synth.cancel(); // Cancel any previous speech
      synth.speak(utterance);
      setIsReading(true);
      setIsPaused(false);
      setShowTextCapture(true);
      
      // Start background music if enabled
      if (enableBackgroundMusic && backgroundMusicRef.current) {
        backgroundMusicRef.current.currentTime = 0; // Start from beginning
        backgroundMusicRef.current.play().catch(error => {
          console.error('Failed to play background music:', error);
          setEnableBackgroundMusic(false);
        });
      }
    }
  };

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

  return (
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
        </div>
      </div>
      
      {errorMessage && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-3">
          <p className="text-sm text-yellow-700">{errorMessage}</p>
        </div>
      )}
      
      {!hasThaiVoice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
          <p className="text-sm text-blue-700">
            No Thai voices detected in your browser. To add Thai voices:
            <ul className="list-disc pl-5 mt-1">
              <li>In Windows: Settings → Time & Language → Language → Add Thai language</li>
              <li>In macOS: System Preferences → Accessibility → Spoken Content → Add Thai voice</li>
              <li>In Chrome: chrome://settings/languages → Add Thai language</li>
            </ul>
          </p>
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
      
      {showTextCapture && (
        <div className="mt-2 p-4 bg-blue-50 border border-blue-100 rounded-md shadow-sm max-h-32 overflow-y-auto">
          <p className="text-lg leading-relaxed">
            {highlightedText ? (
              <span className="font-medium text-blue-800 bg-blue-100 px-1 rounded">
                {highlightedText}
              </span>
            ) : (
              <span className="text-gray-500 italic">Reading article...</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
