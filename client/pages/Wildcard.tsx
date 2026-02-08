import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type CardType = "freeze" | "guess" | "out";
type DrawResult = {
  type: CardType;
  label: string;
};

const CARDS: DrawResult[] = [
  { type: "freeze", label: "Freeze" },
  { type: "guess", label: "Guess the point" },
  { type: "out", label: "2 Member Out" },
];

const CARD_EMOJIS: Record<CardType, string> = {
  freeze: "❄️",
  guess: "🎯",
  out: "❌",
};

// ✅ FIX 1: Hardcoded API URL (Bypasses .env issues)
const API_URL = "https://script.google.com/macros/s/AKfycbzsd4XsCsKCWnFxqPv4VyK6jZ_pEiLhqys9jsDeH4JmNKRhzMsYJgavbXLIX2nlxf5Q/exec";

export default function Wildcard() {
  const { toast } = useToast();
  const [teamInput, setTeamInput] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [currentRound, setCurrentRound] = useState<2 | 3 | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drawnRounds, setDrawnRounds] = useState<{ round2: boolean; round3: boolean }>({
    round2: false,
    round3: false,
  });

  // Load state from localStorage on mount
  useEffect(() => {
    const savedTeam = localStorage.getItem("codeArena_teamId");
    const savedRound2 = localStorage.getItem("codeArena_round2_drawn");
    const savedRound3 = localStorage.getItem("codeArena_round3_drawn");

    if (savedTeam) {
      setTeamInput(savedTeam);
      setIsVerified(true);
    }

    setDrawnRounds({
      round2: !!savedRound2,
      round3: !!savedRound3,
    });

    // Determine next available round based on local storage initially
    if (!savedRound2) {
      setCurrentRound(2);
    } else if (!savedRound3) {
      setCurrentRound(3);
    }
  }, []);

  const validateTeamInput = (input: string): boolean => {
    return /^\d+$/.test(input) && input.length > 0;
  };

  const handleVerifyTeam = async () => {
    if (!validateTeamInput(teamInput)) {
      toast({
        title: "Invalid Team Number",
        description: "Please enter a numeric team number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // ✅ FIX 2: Use 'verify' action and hardcoded URL
      const response = await fetch(`${API_URL}?action=verify&teamId=${teamInput}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "success") {
        toast({
          title: "Team Not Found",
          description: "Please verify your team number in the sheet.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check existing data from Sheet
      const round2Filled = !!data.data.round2;
      const round3Filled = !!data.data.round3;

      // Determine next round logic
      let nextRound: 2 | 3 | null = null;
      if (!round2Filled) {
        nextRound = 2;
      } else if (!round3Filled) {
        nextRound = 3;
      }

      if (nextRound === null) {
        toast({
          title: "All Draws Completed",
          description: "Your team has already drawn for both rounds.",
          variant: "destructive",
        });
        setIsLoading(false);
        // Still allow them to see status, but no round set
        setCurrentRound(null);
      } else {
        setCurrentRound(nextRound);
        toast({
          title: "Team Verified",
          description: `Ready for Round ${nextRound}!`,
        });
      }

      // Update local state
      localStorage.setItem("codeArena_teamId", teamInput);
      setIsVerified(true);
      setDrawnRounds({
        round2: round2Filled,
        round3: round3Filled,
      });

    } catch (error) {
      console.error("Error verifying team:", error);
      toast({
        title: "Connection Error",
        description: "Please switch to Mobile Data (College WiFi blocks this).",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const performDraw = async () => {
    if (!isVerified || currentRound === null) return;

    setIsSpinning(true);
    setResult(null);

    // Simulate spin animation duration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Use cryptographically secure random selection
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const resultIndex = array[0] % 3;
    const selectedCard = CARDS[resultIndex];

    setResult(selectedCard);

    // After animation, submit to backend
    try {
      // ✅ FIX 3: Use GET request with 'save' action
      let url = `${API_URL}?action=save&teamId=${teamInput}`;
      
      if (currentRound === 2) {
        url += `&round2=${encodeURIComponent(selectedCard.label)}`;
      } else {
        url += `&round3=${encodeURIComponent(selectedCard.label)}`;
      }

      const response = await fetch(url); // Default is GET

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "success") {
        throw new Error(data.message || "Failed to record result");
      }

      // Update localStorage
      if (currentRound === 2) {
        localStorage.setItem("codeArena_round2_drawn", "true");
      } else {
        localStorage.setItem("codeArena_round3_drawn", "true");
      }

      setDrawnRounds((prev) => ({
        ...prev,
        [currentRound === 2 ? "round2" : "round3"]: true,
      }));

      // Determine next round locally for UI update
      if (currentRound === 2 && !drawnRounds.round3) {
        // Prepare for next round after a delay
        // Note: You might want to force them to click "Next Round" button instead
      } else {
        // All done
      }

      toast({
        title: "Result Recorded",
        description: "Your wildcard has been recorded successfully.",
      });
    } catch (error) {
      console.error("Error recording result:", error);
      toast({
        title: "Recording Error",
        description: "Could not record result. Check connection.",
        variant: "destructive",
      });
    } finally {
      setIsSpinning(false);
    }
  };

  const handleReset = () => {
    setTeamInput("");
    setIsVerified(false);
    setCurrentRound(null);
    setResult(null);
    localStorage.removeItem("codeArena_teamId");
    localStorage.removeItem("codeArena_round2_drawn");
    localStorage.removeItem("codeArena_round3_drawn");
  };

  return (
    <div className="min-h-screen grid-bg overflow-hidden">
      {/* Header */}
      <header className="border-b border-neon-cyan/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-5 h-5 text-neon-cyan" />
            <h1 className="text-lg sm:text-xl font-orbitron font-bold glow-text">
              WILDCARD DRAW
            </h1>
          </Link>
          {isVerified && (
            <div className="text-right">
              <p className="text-xs text-neon-cyan/70 font-space-mono">TEAM</p>
              <p className="text-lg font-orbitron glow-text">{teamInput}</p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {!isVerified ? (
            // Team Verification Form
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-orbitron font-bold glow-text mb-4">
                  Team Verification
                </h2>
                <p className="text-neon-cyan/70 text-sm sm:text-base">
                  Enter your numeric team number to begin
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-orbitron text-neon-cyan/70 mb-2">
                    Team Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g., 101"
                    className="w-full px-4 py-3 bg-card border-2 border-neon-cyan/50 text-neon-cyan placeholder-neon-cyan/30 font-space-mono focus:outline-none focus:border-neon-cyan focus:shadow-neon transition-all duration-300"
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyTeam()}
                  />
                </div>

                <button
                  onClick={handleVerifyTeam}
                  disabled={isLoading || !validateTeamInput(teamInput)}
                  className="w-full px-6 py-3 border-2 border-neon-cyan text-neon-cyan font-orbitron font-bold uppercase tracking-wider rounded-sm transition-all duration-300 hover:shadow-neon disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <span className="animate-spin">⚙️</span>
                  ) : (
                    <Zap className="w-4 h-4 group-hover:animate-pulse" />
                  )}
                  {isLoading ? "Verifying..." : "Verify Team"}
                </button>
              </div>
            </div>
          ) : result ? (
            // Result Display
            <div className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-orbitron font-bold glow-text mb-4">
                  Your Wildcard
                </h2>
                <p className="text-neon-cyan/70 text-sm sm:text-base">
                  Round {currentRound}
                </p>
              </div>

              <div className="cyber-card p-12 sm:p-16 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/20 via-transparent to-neon-cyan/20 opacity-50" />
                <div className="relative z-10 text-center">
                  <div className="text-7xl sm:text-8xl mb-6 animate-bounce">
                    {CARD_EMOJIS[result.type]}
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-orbitron font-bold glow-text mb-4">
                    {result.label}
                  </h3>
                  <p className="text-neon-cyan/70 text-xs sm:text-sm font-space-mono">
                    Round {currentRound} Result
                  </p>
                </div>

                {/* Corner accents */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/50" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/50" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/50" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/50" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {currentRound === 2 && !drawnRounds.round3 && (
                  <button
                    onClick={() => {
                      setCurrentRound(3);
                      setResult(null);
                    }}
                    className="px-8 py-3 border-2 border-neon-cyan text-neon-cyan font-orbitron font-bold uppercase tracking-wider rounded-sm transition-all duration-300 hover:shadow-neon flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Next Round
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-8 py-3 border-2 border-neon-cyan text-neon-cyan font-orbitron font-bold uppercase tracking-wider rounded-sm transition-all duration-300 hover:shadow-neon flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back Home
                </button>
              </div>

              {drawnRounds.round2 && drawnRounds.round3 && (
                <div className="p-4 bg-card border border-neon-cyan/50 rounded-sm">
                  <p className="text-neon-cyan/80 font-space-mono text-sm">
                    ✓ All draws completed! Your wildcards are locked in.
                  </p>
                </div>
              )}
            </div>
          ) : currentRound ? (
            // Draw Interface
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-orbitron font-bold glow-text mb-2">
                  Round {currentRound}
                </h2>
                <p className="text-neon-cyan/70 text-sm sm:text-base">
                  Select your wildcard
                </p>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 my-8 sm:my-12">
                {CARDS.map((card, index) => (
                  <div
                    key={index}
                    className="cyber-card p-8 h-48 sm:h-56 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-neon transition-all duration-300 cursor-default"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 via-transparent to-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative z-10 text-center">
                      <div className="text-5xl mb-4 animate-float">
                        {CARD_EMOJIS[card.type]}
                      </div>
                      <h3 className="text-lg sm:text-xl font-orbitron glow-text">
                        {card.label}
                      </h3>
                    </div>

                    {/* Corner accents */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-neon-cyan/50" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-neon-cyan/50" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-neon-cyan/50" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-neon-cyan/50" />
                  </div>
                ))}
              </div>

              {/* Draw Button */}
              <div className="flex justify-center">
                <button
                  onClick={performDraw}
                  disabled={isSpinning}
                  className="relative px-12 py-4 border-2 border-neon-cyan text-neon-cyan font-orbitron font-bold text-base uppercase tracking-wider overflow-hidden rounded-sm transition-all duration-300 hover:shadow-neon disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  <div className="absolute inset-0 bg-neon-cyan opacity-0 group-hover:opacity-10 transition-all duration-300" />
                  <span className="relative flex items-center gap-2">
                    {isSpinning ? (
                      <>
                        <span className="animate-spin">⚡</span>
                        Drawing...
                      </>
                    ) : (
                      <>
                        Spin to Draw
                        <Zap className="w-5 h-5 animate-pulse" />
                      </>
                    )}
                  </span>
                </button>
              </div>

              {/* Draw Counter */}
              <div className="text-center text-xs text-neon-cyan/50 font-space-mono space-y-2">
                <p>
                  {drawnRounds.round2 && drawnRounds.round3
                    ? "✓ All rounds completed"
                    : drawnRounds.round2
                      ? "✓ Round 2 drawn • Round 3 pending"
                      : "✓ Round 2 pending • Round 3 pending"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neon-cyan/30 backdrop-blur-sm text-center py-4">
        <p className="text-xs text-neon-cyan/50 font-space-mono">
          CODE ARENA © 2026 | SDJ International College
        </p>
      </footer>
    </div>
  );
}
