// Onboarding Checklist - Gamified First-Week Experience
import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Zap, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const onboardingTasks = [
  {
    id: 'profile',
    title: 'Profil vervollständigen',
    description: 'Setze dein Passfoto & Kontaktdaten',
    icon: '👤',
    points: 100,
    action: '/settings'
  },
  {
    id: 'first_clock',
    title: 'Erste Zeiterfassung',
    description: 'Stempel dich ein & wieder aus',
    icon: '⏱️',
    points: 200,
    verified: 'database' // System verifiziert automatisch
  },
  {
    id: 'read_recipes',
    title: 'Rezepte anschauen',
    description: 'Durchblätter 5 Cocktail-Rezepte',
    icon: '🍹',
    points: 150,
    action: '/recipes'
  },
  {
    id: 'understand_shift',
    title: 'Erste Schicht verstehen',
    description: 'Öffne deine nächste geplante Schicht',
    icon: '📅',
    points: 200,
    verified: 'database'
  },
  {
    id: 'read_manual',
    title: 'BarManager Anleitung lesen',
    description: 'Lies die wichtigsten Tipps & Tricks',
    icon: '📖',
    points: 250,
    action: '/documents'
  },
  {
    id: 'team_intro',
    title: 'Team kennenlernen',
    description: 'Schau das Mitarbeiter-Verzeichnis an',
    icon: '👥',
    points: 100,
    action: '/employees'
  }
];

export function OnboardingChecklist() {
  const [tasks, setTasks] = useState(onboardingTasks.map(t => ({ ...t, completed: false })));
  const [userPoints, setUserPoints] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Lade abgeschlossene Aufgaben
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const user = await base44.auth.me();
      const onboardingData = user?.onboarding_progress || {};
      
      setTasks(prev => prev.map(task => ({
        ...task,
        completed: onboardingData[task.id] || false
      })));

      const completed = Object.values(onboardingData).filter(Boolean).length;
      setProgress((completed / onboardingTasks.length) * 100);
      setUserPoints(completed * 100);
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
    }
  };

  const completeTask = async (taskId) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: true } : t
    ));

    // Speichere in User Daten
    try {
      await base44.auth.updateMe({
        onboarding_progress: {
          ...tasks.reduce((acc, t) => ({
            ...acc,
            [t.id]: t.id === taskId ? true : t.completed
          }), {})
        }
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const earnedPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0);

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 mb-4">
          <Trophy className="w-8 h-8 text-slate-900" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Onboarding-Quest</h2>
        <p className="text-muted-foreground">Willkommen im Team! Komplettiere deine erste Woche.</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">
            {completedCount} von {tasks.length} Aufgaben
          </span>
          <span className="text-sm font-bold text-amber-500">
            {earnedPoints} / {totalPoints} Punkte
          </span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-3 mb-8">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'p-4 rounded-lg border transition-all',
              task.completed
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-card border-border hover:border-primary/50 cursor-pointer'
            )}
            onClick={() => !task.completed && task.action && (window.location.href = task.action)}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  completeTask(task.id);
                }}
                className="mt-0.5 transition-transform hover:scale-110"
              >
                {task.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground hover:text-primary" />
                )}
              </button>

              <div className="flex-1">
                <h3 className={cn(
                  'font-semibold',
                  task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                )}>
                  {task.icon} {task.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm font-bold text-amber-500">
                  +{task.points}
                </span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion Message */}
      {completedCount === tasks.length && (
        <div className="p-6 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 text-center">
          <h3 className="text-lg font-bold text-green-500 mb-2">🎉 Super gemacht!</h3>
          <p className="text-sm text-muted-foreground">
            Du hast dein Onboarding abgeschlossen. Viel Spaß bei der Arbeit!
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <h4 className="text-sm font-bold text-blue-400 mb-2">💡 Tipp</h4>
        <p className="text-sm text-muted-foreground">
          Du kannst diese Liste jederzeit in deinen Einstellungen erneut ansehen.
        </p>
      </div>
    </div>
  );
}

export function useOnboardingProgress() {
  const [progress, setProgress] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const user = await base44.auth.me();
      const onboardingData = user?.onboarding_progress || {};
      const completed = Object.values(onboardingData).filter(Boolean).length;
      
      setProgress((completed / onboardingTasks.length) * 100);
      setIsCompleted(completed === onboardingTasks.length);
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
    }
  };

  return { progress, isCompleted, reload: loadProgress };
}