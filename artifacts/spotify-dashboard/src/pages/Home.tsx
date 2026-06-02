import { useGetLoginUrl } from "@workspace/api-client-react";
import { SiSpotify } from "react-icons/si";
import { useAuth } from "../contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: loginData } = useGetLoginUrl();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary"><SiSpotify className="w-12 h-12 animate-pulse" /></div>;
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  const handleLogin = () => {
    if (loginData?.url) {
      (window.top ?? window).location.href = loginData.url;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Green glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="z-10 text-center flex flex-col items-center max-w-2xl px-4">
        <SiSpotify className="w-20 h-20 text-primary mb-8" />
        <h1 className="text-6xl md:text-8xl font-black text-foreground tracking-tighter mb-4">
          Statify
        </h1>
        <p className="text-2xl md:text-3xl text-primary font-bold mb-6">
          Your music, analyzed.
        </p>
        <p className="text-muted-foreground text-lg mb-12 max-w-lg mx-auto">
          A personal music analytics dashboard for Spotify power users. Go deeper than your Wrapped.
        </p>
        
        <Button 
          size="lg" 
          onClick={handleLogin}
          disabled={!loginData}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 h-14 rounded-full font-bold shadow-[0_0_40px_rgba(29,185,84,0.4)] transition-all hover:scale-105"
        >
          <SiSpotify className="mr-2 w-6 h-6" />
          Continue with Spotify
        </Button>
      </div>
    </div>
  );
}
