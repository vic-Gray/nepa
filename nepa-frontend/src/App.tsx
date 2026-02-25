import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { createSkipLink, landmarkRoles } from './utils/accessibility';
import './index.css';

const App: React.FC = () => {
  React.useEffect(() => {
    // Add skip link
    const skipLink = createSkipLink('main-content');
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    return () => {
      if (skipLink.parentNode) {
        skipLink.parentNode.removeChild(skipLink);
      }
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header role={landmarkRoles.banner} className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">NEPA Platform</h1>
            <ThemeToggle />
          </div>
        </header>
        
        <nav role={landmarkRoles.navigation} aria-label="Main navigation">
          {/* Navigation content can go here */}
        </nav>
        
        <main id="main-content" role={landmarkRoles.main} className="container mx-auto px-4 py-8" tabIndex={-1}>
          <div className="space-y-8">
            <section aria-labelledby="welcome-heading">
              <h2 id="welcome-heading" className="text-3xl font-semibold text-foreground">Welcome to NEPA</h2>
              <p className="text-muted-foreground text-lg">
                Modern utility management platform with advanced analytics and payment processing.
              </p>
            </section>
            
            <section aria-labelledby="features-heading">
              <h2 id="features-heading" className="sr-only">Platform Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <article className="bg-card border border-border rounded-lg p-6 shadow focus-within:ring-2 focus-within:ring-ring">
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">Payment Processing</h3>
                  <p className="text-muted-foreground">Secure and efficient payment processing with multiple payment options.</p>
                </article>
                
                <article className="bg-card border border-border rounded-lg p-6 shadow focus-within:ring-2 focus-within:ring-ring">
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">Usage Analytics</h3>
                  <p className="text-muted-foreground">Detailed insights into your utility consumption patterns and trends.</p>
                </article>
                
                <article className="bg-card border border-border rounded-lg p-6 shadow focus-within:ring-2 focus-within:ring-ring">
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">Smart Monitoring</h3>
                  <p className="text-muted-foreground">Real-time monitoring and alerts for your utility services.</p>
                </article>
              </div>
            </section>
          </div>
        </main>
        
        <footer role={landmarkRoles.contentinfo} className="border-t border-border bg-card mt-12">
          <div className="container mx-auto px-4 py-6">
            <p className="text-muted-foreground text-center">
              2024 NEPA Platform. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
};

export default App;