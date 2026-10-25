import React, { useState } from 'react';
import { simulateNewCgpa } from '../utils/gpaCalculator.js';
import AppDialog from './AppDialog';
import {
  Calculator,
  PlusCircle,
  AlertCircle
} from 'lucide-react';

export default function GpaSimulatorModal({ open, onClose }) {
  const [pastCredits, setPastCredits] = useState(0);
  const [pastPoints, setPastPoints] = useState(0);
  const [pastCourses, setPastCourses] = useState([]);
  const [currentCourses, setCurrentCourses] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addPastCourse = (code, credits, grade) => {
    setPastCourses(prev => [...prev, { courseCode: code, credits: Number(credits) || 1, grade }]);
  };

  const addCurrentCourse = (code, credits, grade) => {
    setCurrentCourses(prev => [...prev, { courseCode: code, credits: Number(credits) || 1, grade }]);
  };

  const handleSimulate = () => {
    setLoading(true);
    setError('');
    try {
      const res = simulateNewCgpa({
        pastCompletedCredits: pastCredits,
        pastTotalPoints: pastPoints,
        pastCourses,
        currentCourses
      });
      setResult(res);
    } catch (e) {
      setError(e.message || 'Hesaplama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      isOpen={open}
      onClose={onClose}
      title="GPA Simülatörü"
      description="Geçen dönem notlarınız ve bu dönemki derslerinizi girerek yeni genel not ortalamanızı (newCgpa) ve dönem not ortalamanızı (termGpa) hesaplayın."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-subtle text-ink font-medium hover:bg-surface-muted transition text-sm"
          >
            Kapat
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Past Completed Courses */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Calculator className="w-4 h-4 text-brand" />
            <label className="font-semibold text-ink">Geçen Dönem Kredisi</label>
            <input
              type="number"
              value={pastCredits}
              onChange={e => setPastCredits(Number(e.target.value) || 0)}
              min="0"
              className="w-24 px-2 py-1 bg-surface border border-border-subtle rounded text-ink font-mono text-xs"
            />
            <label className="font-semibold text-ink ml-4">Toplam Puan</label>
            <input
              type="number"
              value={pastPoints}
              onChange={e => setPastPoints(Number(e.target.value) || 0)}
              min="0"
              step="0.01"
              className="w-24 px-2 py-1 bg-surface border border-border-subtle rounded text-ink font-mono text-xs"
            />
            <button
              onClick={() => { setPastCourses([]); setPastCredits(0); setPastPoints(0); }}
              className="text-xs text-ink-muted ml-auto"
            >
              Temizle
            </button>
          </div>

          <div className="space-y-1">
            {pastCourses.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={c.courseCode}
                  onChange={e =>
                    setPastCourses(
                      pastCourses.map((x, idx) =>
                        idx === i ? { ...c, courseCode: e.target.value } : x
                      )
                    )
                  }
                  className="flex-1 min-w-[80px] px-2 py-1 bg-surface border border-border-subtle rounded text-ink"
                  placeholder="Ders kodu"
                />
                <input
                  type="number"
                  value={c.credits}
                  onChange={e =>
                    setPastCourses(
                      pastCourses.map((x, idx) =>
                        idx === i ? { ...c, credits: Number(e.target.value) || 1 } : x
                      )
                    )
                  }
                  min="1"
                  className="w-16 px-2 py-1 bg-surface border border-border-subtle rounded text-ink font-mono"
                />
                <select
                  value={c.grade}
                  onChange={e =>
                    setPastCourses(
                      pastCourses.map((x, idx) =>
                        idx === i ? { ...c, grade: e.target.value } : x
                      )
                    )
                  }
                  className="px-2 py-1 bg-surface border border-border-subtle rounded text-ink"
                >
                  <option value="AA">AA</option>
                  <option value="BA">BA</option>
                  <option value="BB">BB</option>
                  <option value="CB">CB</option>
                  <option value="CC">CC</option>
                  <option value="DC">DC</option>
                  <option value="DD">DD</option>
                  <option value="FD">FD</option>
                  <option value="FF">FF</option>
                </select>
              </div>
            ))}

            <button
              onClick={() => addPastCourse('', 1, 'AA')}
              className="flex items-center gap-1.5 text-amber-600 hover:text-amber-400"
            >
              <PlusCircle className="w-3 h-3" />
              Ders ekle
            </button>
            <button
              onClick={() => { setPastCourses([]); setPastCredits(0); setPastPoints(0); }}
              className="text-xs text-amber-600 hover:text-amber-400 mt-1"
            >
              Hepsini Temizle
            </button>
          </div>
        </div>

        {/* Current Semester Courses */}
        <div className="space-y-2 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-brand" />
            <label className="font-semibold text-ink">Mevcut Dönem Dersleri</label>
            <button
              onClick={() => addCurrentCourse('', '', 'AA')}
              className="text-xs text-amber-600 hover:text-amber-400 ml-auto"
            >
              <PlusCircle className="w-3 h-3" />
              Yeni ders ekle (AA)
            </button>
          </div>

          {currentCourses.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={c.courseCode}
                onChange={e =>
                  setCurrentCourses(
                    currentCourses.map((x, idx) =>
                      idx === i ? { ...c, courseCode: e.target.value } : x
                    )
                  )
                }
                className="flex-1 min-w-[80px] px-2 py-1 bg-surface border border-border-subtle rounded text-ink"
                placeholder="Ders kodu"
              />
              <input
                type="number"
                value={c.credits}
                onChange={e =>
                  setCurrentCourses(
                    currentCourses.map((x, idx) =>
                      idx === i ? { ...c, credits: Number(e.target.value) || 1 } : x
                    )
                  )
                }
                min="1"
                className="w-16 px-2 py-1 bg-surface border border-border-subtle rounded text-ink font-mono"
              />
              <select
                value={c.grade}
                onChange={e =>
                  setCurrentCourses(
                    currentCourses.map((x, idx) =>
                      idx === i ? { ...c, grade: e.target.value } : x
                    )
                  )
                }
                className="px-2 py-1 bg-surface border border-border-subtle rounded text-ink"
              >
                <option value="AA">AA</option>
                <option value="BA">BA</option>
                <option value="BB">BB</option>
                <option value="CB">CB</option>
                <option value="CC">CC</option>
                <option value="DC">DC</option>
                <option value="DD">DD</option>
                <option value="FD">FD</option>
                <option value="FF">FF</option>
              </select>
            </div>
          ))}

          <button
            onClick={() => setCurrentCourses([])}
            className="text-xs text-amber-600 hover:text-amber-400 mt-1"
          >
            Hepsini Temizle
          </button>
        </div>

        {/* Result */}
        {loading && (
          <p className="text-center text-amber-600">Hesaplanıyor…</p>
        )}
        {result && (
          <div className="mt-2 p-3 bg-surface rounded-xl border border-border-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Yeni Ortalama (newCgpa)</span>
              <span className="font-bold text-brand tabular-nums text-lg">{result.newCgpa.toFixed(3)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Dönem Ortalama (termGpa)</span>
              <span className="font-semibold text-ink tabular-nums">{result.termGpa.toFixed(3)}</span>
            </div>
            {!pastCredits && (
              <p className="text-xs text-ink-muted mt-1">
                Geçen dönem verisi eklenmeden sadece mevcut dersler üzerinden
                dönem ortalaması hesaplanıyor.
              </p>
            )}
          </div>
        )}
        {error && (
          <p className="flex items-center gap-2 text-rose-600 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        )}
        <div className="pt-2 border-t border-border-subtle flex justify-end">
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="primary-action text-sm flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <span>Hesapla</span>
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
