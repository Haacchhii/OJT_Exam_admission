import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdmissions } from '../api/admissions';
import Icon from './Icons';
import { showToast } from './Toast';
import type { Admission } from '../types';
import { asArray, formatPersonName } from '../utils/helpers';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearchError('');
      setActiveIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setSearchError('');
      try {
        const res = await getAdmissions({ search: term });
        setResults(asArray(res).slice(0, 5) as Admission[]);
      } catch (err) {
        setResults([]);
        setSearchError('Search is temporarily unavailable. Please try again.');
        showToast('Search is temporarily unavailable. Please try again.', 'error');
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const handleSelect = (id: number) => {
    setIsOpen(false);
    setTerm('');
    navigate('/employee/admissions?id=' + id);
  };

  const listboxId = 'global-search-listbox';

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      return;
    }

    if (e.key === 'Enter' && isOpen && activeIndex >= 0 && activeIndex < results.length) {
      e.preventDefault();
      handleSelect(results[activeIndex].id);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-64 max-w-sm">
      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={term}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && term.trim().length >= 2}
          aria-controls={listboxId}
          aria-label="Global applicant search"
          onChange={(e) => {
            setTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (term.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search applicants..."
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-forest-500 focus:border-forest-500 block pl-10 p-2 outline-none transition-colors"
        />
        {loading && <Icon name="spinner" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
      </div>

      {isOpen && term.trim().length >= 2 && (
        <div id={listboxId} role="listbox" className="absolute top-full mt-1.5 w-full sm:w-80 right-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, index) => (
                <li key={r.id} role="option" aria-selected={activeIndex === index} className="border-b border-gray-50 last:border-0">
                  <button
                    type="button"
                    onClick={() => handleSelect(r.id)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${activeIndex === index ? 'bg-forest-50' : 'hover:bg-gray-50'}`}
                  >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatPersonName(r)}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.gradeLevel}</span>
                  </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : searchError ? (
            <div className="px-4 py-6 text-center text-sm text-red-500">{searchError}</div>
          ) : !loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No applicants found for "{term}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
