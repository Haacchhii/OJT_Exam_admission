import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdmissions } from '../api/admissions';
import Icon from './Icons';
import type { Admission } from '../types';
import { asArray } from '../utils/helpers';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(false);
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
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getAdmissions({ search: term });
        setResults(asArray(res).slice(0, 5) as Admission[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [term]);

  const handleSelect = (id: number) => {
    setIsOpen(false);
    setTerm('');
    navigate('/employee/admissions?id=' + id);
  };

  return (
    <div ref={wrapperRef} className="relative hidden sm:block w-64 max-w-sm">
      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (term.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search applicants..."
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-forest-500 focus:border-forest-500 block pl-10 p-2 outline-none transition-colors"
        />
        {loading && <Icon name="spinner" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
      </div>

      {isOpen && term.trim().length >= 2 && (
        <div className="absolute top-full mt-1.5 w-80 right-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.id} onClick={() => handleSelect(r.id)} className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{r.gradeLevel}</span>
                  </div>
                </li>
              ))}
            </ul>
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
