import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, BookOpen, Eraser, Globe, Clock, Moon, Sun } from 'lucide-react';
import { ImageEditor } from './components/ImageEditor';
import { StoryMaker } from './components/StoryMaker';
import { MagicEraser } from './components/MagicEraser';
import { HistorySidebar } from './components/HistorySidebar';
import { Lang, ToolType } from './types';

export default function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTool, setActiveTool] = useState<ToolType>('imageEditor');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      document.body.classList.add('light');
    } else {
      root.classList.remove('light');
      document.body.classList.remove('light');
    }
  }, [theme]);

  const toggleLang = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { id: 'imageEditor', icon: ImageIcon, label: lang === 'ar' ? 'محرر الصور' : 'Image Editor' },
    { id: 'storyMaker', icon: BookOpen, label: lang === 'ar' ? 'صانع القصص' : 'Story Maker' },
    { id: 'magicEraser', icon: Eraser, label: lang === 'ar' ? 'الممحاة السحرية' : 'Magic Eraser' },
  ];

  const appTitle = lang === 'ar' ? 'الأداة الأقوى لصناعة المحتوى بالذكاء الاصطناعي' : 'The Most Powerful AI Content Creation Tool';
  const copyright = lang === 'ar' ? 'جميع الحقوق محفوظة لـ Youssef Mostafa' : 'All rights reserved to Youssef Mostafa';
  const subtitle = lang === 'ar' 
    ? 'أطلق العنان لإبداعك مع محرر الصور، صانع القصص، والممحاة السحرية.' 
    : 'Unleash your creativity with Image Editor, Story Maker, and Magic Eraser.';

  return (
    <div className={`min-h-screen bg-app-bg text-app-text font-cairo ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-app-bg/80 backdrop-blur-md border-b border-app-border transition-colors duration-300">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-app-text to-app-muted bg-clip-text text-transparent">
              {/* Promptopia Removed */}
            </h1>
            
            <div className="flex gap-2 items-center">
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-app-surface transition-colors flex items-center gap-2 text-app-muted hover:text-brand-orange"
                  title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button 
                  onClick={() => setIsHistoryOpen(true)}
                  className="p-2 rounded-full hover:bg-app-surface transition-colors flex items-center gap-2 text-app-muted hover:text-brand-orange"
                  title={lang === 'ar' ? 'السجل' : 'History'}
                >
                  <Clock size={20} />
                </button>
                <button 
                  id="lang-tog"
                  onClick={toggleLang}
                  className="p-2 rounded-full hover:bg-app-surface transition-colors flex items-center gap-2 text-app-muted hover:text-brand-orange"
                >
                  <Globe size={20} />
                  <span className="text-sm font-bold uppercase">{lang}</span>
                </button>

                {/* User Profile Picture */}
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-brand-orange shadow-[0_0_10px_rgba(255,122,0,0.3)] ml-2 transition-transform hover:scale-105 cursor-pointer">
                    {/* Replace src with your actual image URL */}
                    <img 
                      src="https://ui-avatars.com/api/?name=Youssef+Mostafa&background=FF7A00&color=fff&size=128" 
                      alt="Youssef Mostafa" 
                      className="w-full h-full object-cover" 
                    />
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-32">
        {/* Tool Title Banner */}
        <div className="text-center mb-10 animate-fade-in-up">
           <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-app-text via-brand-orange to-app-text animate-gradient-x">
             {appTitle}
           </h2>
           <p className="text-app-muted max-w-2xl mx-auto text-lg">
             {subtitle}
           </p>
        </div>

        {/* Active Tool View */}
        <div className="max-w-7xl mx-auto">
           {activeTool === 'imageEditor' && <ImageEditor lang={lang} />}
           {activeTool === 'storyMaker' && <StoryMaker lang={lang} />}
           {activeTool === 'magicEraser' && <MagicEraser lang={lang} />}
        </div>
      </main>

      {/* History Sidebar */}
      <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} lang={lang} />

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-app-input border-t border-app-border pb-safe z-50 transition-colors duration-300">
         <div className="container mx-auto px-4">
            <div className="flex justify-around items-center h-20">
               {navItems.map((item) => {
                 const isActive = activeTool === item.id;
                 const Icon = item.icon;
                 return (
                   <button
                     key={item.id}
                     onClick={() => setActiveTool(item.id as ToolType)}
                     className={`flex flex-col items-center gap-1 transition-all duration-300 w-full ${isActive ? 'text-brand-orange -translate-y-2' : 'text-app-muted hover:text-app-text'}`}
                   >
                     <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-brand-orange/10 shadow-[0_0_20px_rgba(255,122,0,0.3)]' : ''}`}>
                       <Icon size={24} strokeWidth={isActive ? 3 : 2} />
                     </div>
                     <span className="text-xs font-bold">{item.label}</span>
                   </button>
                 );
               })}
            </div>
            <div className="text-center pb-2">
                <p className="text-[10px] text-app-surface-2">{copyright}</p>
            </div>
         </div>
      </nav>

      {/* Tailwind Animations */}
      <style>{`
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientX {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-fade-in {
            animation: fadeInUp 0.4s ease-out forwards;
        }
        .animate-gradient-x {
            background-size: 200% auto;
            animation: gradientX 5s linear infinite;
        }
        .animate-float {
            animation: float 5s ease-in-out infinite;
        }
        .pb-safe {
            padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
}