import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  Clock, 
  History, 
  Settings, 
  AlertCircle,
  Database,
  GitCompare,
  List,
  CheckCircle2,
  XCircle,
  Trash2,
  Volume2,
  VolumeX,
  Download
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { DrawRecord, Recommendation } from './types';

// Mock data generator for demo purposes
const generateMockDraws = (): DrawRecord[] => {
  const now = new Date();
  return Array.from({ length: 60 }).map((_, i) => {
    const drawTime = new Date(now.getTime() - i * 5 * 60000);
    const period = format(drawTime, 'yyyyMMdd') + String(120 - i).padStart(3, '0');
    // Generate 10 unique numbers from 1 to 10
    const numbers = Array.from({ length: 10 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    const result = numbers.slice(0, 10); 
    const sum = result.reduce((a, b) => a + b, 0);
    const bigSmall = sum > 25 ? '大' : '小';
    const oddEven = sum % 2 === 0 ? '双' : '单';
    return {
      period,
      time: format(drawTime, 'HH:mm:ss'),
      result: result.join(', '),
      sum,
      bigSmall,
      oddEven,
    };
  });
};

const getNumberColor = (num: string) => {
  const n = parseInt(num);
  const colors: { [key: number]: string } = {
    1: 'bg-[#E6E600]', // Yellow
    2: 'bg-[#0099FF]', // Blue
    3: 'bg-[#4D4D4D]', // Dark Gray
    4: 'bg-[#FF9933]', // Orange
    5: 'bg-[#00CCCC]', // Cyan
    6: 'bg-[#6633FF]', // Purple
    7: 'bg-[#B3B3B3]', // Light Gray
    8: 'bg-[#FF3333]', // Red
    9: 'bg-[#660000]', // Dark Red
    10: 'bg-[#00CC00]', // Green
  };
  return colors[n] || 'bg-gray-400';
};

export default function App() {
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdownDuration, setCountdownDuration] = useState<number>(5);
  const [nextDrawTime, setNextDrawTime] = useState<Date>(() => {
    const now = new Date();
    const nextMins = Math.ceil((now.getMinutes() + 1) / 5) * 5;
    const d = new Date(now);
    d.setMinutes(nextMins, 0, 0);
    return d;
  });
  const [timeLeft, setTimeLeft] = useState<number>(300);
  
  // Update nextDrawTime when duration changes
  useEffect(() => {
    const now = new Date();
    const currentMins = now.getMinutes();
    const nextMins = Math.floor(currentMins / countdownDuration) * countdownDuration + countdownDuration;
    const nextBoundary = new Date(now);
    nextBoundary.setMinutes(nextMins, 0, 0);
    if (nextBoundary <= now) {
      nextBoundary.setMinutes(nextBoundary.getMinutes() + countdownDuration);
    }
    setNextDrawTime(nextBoundary);
    setTimeLeft(differenceInSeconds(nextBoundary, now));
  }, [countdownDuration]);
  const [url, setUrl] = useState<string>('https://auluckylottery.com/results/lucky-ball-10/');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualData, setManualData] = useState<string>('');

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [lastAttempt, setLastAttempt] = useState<Date>(new Date());

  const [nextPeriod, setNextPeriod] = useState<string | null>(null);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => {
    const saved = localStorage.getItem('lottery_recommendations');
    return saved ? JSON.parse(saved) : [];
  });
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [enableVoice, setEnableVoice] = useState<boolean>(() => {
    const saved = localStorage.getItem('lottery_voice_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [lastClearedPeriod, setLastClearedPeriod] = useState<string | null>(() => {
    return localStorage.getItem('lottery_last_cleared_period');
  });
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Save recommendations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('lottery_recommendations', JSON.stringify(recommendations));
  }, [recommendations]);

  // Save voice setting
  useEffect(() => {
    localStorage.setItem('lottery_voice_enabled', JSON.stringify(enableVoice));
  }, [enableVoice]);

  // Save last cleared period
  useEffect(() => {
    if (lastClearedPeriod) {
      localStorage.setItem('lottery_last_cleared_period', lastClearedPeriod);
    }
  }, [lastClearedPeriod]);

  const handleClearRecommendations = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowClearConfirm(true);
  };

  const confirmClearRecommendations = () => {
    // Record the current next period to prevent immediate regeneration
    if (draws.length > 0) {
      const latestDraw = draws[0];
      const nextPeriodStr = String(BigInt(latestDraw.period) + 1n);
      setLastClearedPeriod(nextPeriodStr);
    }
    setRecommendations([]);
    localStorage.removeItem('lottery_recommendations');
    setShowClearConfirm(false);
  };

  const handleManualEntry = () => {
    try {
      // Expecting format: period,result (one per line)
      const lines = manualData.split('\n').filter(l => l.trim());
      const newDraws: DrawRecord[] = lines.map(line => {
        const [period, result] = line.split(',').map(s => s.trim());
        const numbers = result.split(/[\s]+/).filter(n => n.length > 0);
        const sum = numbers.reduce((a, b) => a + (parseInt(b) || 0), 0);
        return {
          period,
          result: numbers.join(', '),
          time: format(new Date(), 'HH:mm:ss'),
          sum,
          bigSmall: sum >= 14 ? '大' : '小',
          oddEven: sum % 2 === 0 ? '双' : '单'
        };
      });
      if (newDraws.length > 0) {
        setDraws(newDraws);
        setLastUpdated(new Date());
        setShowSettings(false);
        setError(null);
      }
    } catch (e) {
      setError("手动输入格式错误。请使用：期号,结果 (例如: 20240101001,1 2 3)");
    }
  };

  const handleRefresh = useCallback(async (targetUrl: string = url) => {
    setLoading(true);
    setError(null);
    setLastAttempt(new Date());
    try {
      const response = await fetch('/api/fetch-draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      if (data.draws && data.draws.length > 0) {
        setDraws(data.draws);
        setLastUpdated(new Date());
        setNextPeriod(data.nextPeriod || null);
        
        // Sync countdown with server data
        if (data.secondsLeft !== null && data.secondsLeft !== undefined) {
          setTimeLeft(data.secondsLeft);
          setNextDrawTime(new Date(Date.now() + data.secondsLeft * 1000));
        } else if (data.nextDrawTime) {
          let nextDate = new Date(data.nextDrawTime);
          // If it's just HH:mm, parse it relative to today
          if (isNaN(nextDate.getTime()) && /^\d{1,2}:\d{2}/.test(data.nextDrawTime)) {
            const [h, m] = data.nextDrawTime.split(':').map(Number);
            nextDate = new Date();
            nextDate.setHours(h, m, 0, 0);
            // If the time is in the past, assume it's for tomorrow
            if (nextDate < new Date()) {
              nextDate.setDate(nextDate.getDate() + 1);
            }
          }
          
          if (!isNaN(nextDate.getTime())) {
            setNextDrawTime(nextDate);
            setTimeLeft(differenceInSeconds(nextDate, new Date()));
          }
        }
      } else {
        // Fallback to mock if no data found but request succeeded
        if (draws.length === 0) setDraws(generateMockDraws());
        setError("目标接口/网址未发现数据，正在显示模拟数据。");
      }
    } catch (err: any) {
      console.error(err);
      setError("连接错误，正在显示模拟数据。");
      if (draws.length === 0) setDraws(generateMockDraws());
    } finally {
      setLoading(false);
    }
  }, [url, draws.length]);

  // Initialize with real data
  useEffect(() => {
    handleRefresh();
  }, []);

  // Auto-refresh data
  useEffect(() => {
    // Refresh based on setting, but faster if countdown is near zero
    if (autoRefreshInterval <= 0) return;
    
    const intervalTime = timeLeft < 10 ? 5000 : autoRefreshInterval * 1000;
    const refreshInterval = setInterval(() => {
      handleRefresh();
    }, intervalTime);
    return () => clearInterval(refreshInterval);
  }, [handleRefresh, timeLeft, autoRefreshInterval]);

  // Countdown timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const seconds = differenceInSeconds(nextDrawTime, now);
      
      if (seconds <= 0) {
        // When countdown hits zero, trigger a refresh to get new results
        handleRefresh();
        
        // Calculate next boundary as a fallback
        const nextBoundary = new Date(now);
        const currentMins = nextBoundary.getMinutes();
        const nextMins = Math.floor(currentMins / countdownDuration) * countdownDuration + countdownDuration;
        nextBoundary.setMinutes(nextMins, 0, 0);
        
        // If the calculated boundary is still in the past or now, add another duration
        if (nextBoundary <= now) {
          nextBoundary.setMinutes(nextBoundary.getMinutes() + countdownDuration);
        }
        
        setNextDrawTime(nextBoundary);
        setTimeLeft(differenceInSeconds(nextBoundary, now));
      } else {
        setTimeLeft(seconds);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextDrawTime, handleRefresh, countdownDuration]);

  // Recommendation Logic
  useEffect(() => {
    if (draws.length < 50) return;

    const latestDraw = draws[0];
    const nextPeriodStr = String(BigInt(latestDraw.period) + 1n);

    // 1. Check if we already have a recommendation for the NEXT period
    // If so, do nothing (wait for next draw)
    // BUT we also need to check if the CURRENT period (latestDraw) was predicted previously
    // and update its status if pending.

    setRecommendations(prev => {
      const newRecs = [...prev];
      let changed = false;

      // Update pending recommendations
      newRecs.forEach(rec => {
        if (rec.status === 'pending' && rec.period === latestDraw.period) {
          const champion = Array.isArray(latestDraw.result) 
            ? latestDraw.result[0] 
            : parseInt(String(latestDraw.result).split(/[,\s]+/)[0]);
          
          rec.actualChampion = champion;
          const isWon = rec.recommendedNumbers.includes(champion);
          rec.status = isWon ? 'won' : 'lost';
          
          // Calculate Profit
          // Step 1: Bet 10/num -> Cost 40. Prize 99.
          // Step 2: Bet 20/num -> Cost 80. Prize 198.
          // Step 3: Bet 40/num -> Cost 160. Prize 396.
          // Step 4: Bet 80/num -> Cost 320. Prize 792.
          const baseBet = 10 * Math.pow(2, (rec.bettingStep || 1) - 1);
          const cost = baseBet * 4;
          const prize = isWon ? (baseBet * 9.9) : 0;
          rec.profit = prize - cost;

          changed = true;
        }
      });

      // Check if we need to generate a NEW recommendation for nextPeriodStr
      const exists = newRecs.some(r => r.period === nextPeriodStr);
      if (!exists && nextPeriodStr !== lastClearedPeriod) {
        // Perform Analysis
        // Logic:
        // 2nd (draws[1]) vs 47th (draws[47])
        // 3rd (draws[2]) vs 48th (draws[48])
        // Latest (draws[0]) vs 46th (draws[46])

        const getPosition = (championDraw: DrawRecord, targetDraw: DrawRecord) => {
          const champion = Array.isArray(championDraw.result) 
            ? championDraw.result[0] 
            : parseInt(String(championDraw.result).split(/[,\s]+/)[0]);
          
          const targetNums = Array.isArray(targetDraw.result)
            ? targetDraw.result
            : String(targetDraw.result).split(/[,\s]+/).map(n => parseInt(n.trim()));
          
          const leftHalf = targetNums.slice(0, 5);
          const rightHalf = targetNums.slice(5);

          if (leftHalf.includes(champion)) return 'left';
          if (rightHalf.includes(champion)) return 'right';
          return 'none';
        };

        const p2 = getPosition(draws[1], draws[47]);
        const p3 = getPosition(draws[2], draws[48]);
        const p1 = getPosition(draws[0], draws[46]);

        let patternType = '';
        if (p2 === 'left' && p3 === 'left' && p1 === 'right') {
          patternType = 'Left-Right';
        } else if (p2 === 'right' && p3 === 'right' && p1 === 'left') {
          patternType = 'Right-Left';
        }

        if (patternType) {
          // Generate Prediction
          // Source: draws[45]
          // Key: draws[0].champion
          // Position Check: draws[46]
          const champion = Array.isArray(draws[0].result) 
            ? draws[0].result[0] 
            : parseInt(String(draws[0].result).split(/[,\s]+/)[0]);
          
          // Check position in 46th draw
          const targetDraw46 = draws[46];
          const targetNums46 = Array.isArray(targetDraw46.result)
            ? targetDraw46.result
            : String(targetDraw46.result).split(/[,\s]+/).map(n => parseInt(n.trim()));
          
          const index = targetNums46.indexOf(champion); // 0-based index in 46th draw

          // Pick numbers from 45th draw
          const targetDraw45 = draws[45];
          const targetNums45 = Array.isArray(targetDraw45.result)
            ? targetDraw45.result
            : String(targetDraw45.result).split(/[,\s]+/).map(n => parseInt(n.trim()));

          let recommendedNumbers: number[] = [];

          if (index === 0) { // 1st position in 46th
            // 1, 3, 4, 5名 -> indices 0, 2, 3, 4 from 45th
            recommendedNumbers = [targetNums45[0], targetNums45[2], targetNums45[3], targetNums45[4]];
          } else if (index === 9) { // 10th position in 46th
            // 6, 7, 8, 10名 -> indices 5, 6, 7, 9 from 45th
            recommendedNumbers = [targetNums45[5], targetNums45[6], targetNums45[7], targetNums45[9]];
          } else if (index >= 1 && index <= 4) { // Left half (not 1st) in 46th
            // 2, 3, 4, 5名 -> indices 1, 2, 3, 4 from 45th
            recommendedNumbers = [targetNums45[1], targetNums45[2], targetNums45[3], targetNums45[4]];
          } else if (index >= 5 && index <= 8) { // Right half (not 10th) in 46th
            // 6, 7, 8, 9名 -> indices 5, 6, 7, 8 from 45th
            recommendedNumbers = [targetNums45[5], targetNums45[6], targetNums45[7], targetNums45[8]];
          }

          if (recommendedNumbers.length > 0) {
            // Calculate betting step
            let bettingStep = 1;
            const lastRec = newRecs.find(r => r.status !== 'pending'); // Find the most recent completed recommendation
            
            if (lastRec) {
              if (lastRec.status === 'lost') {
                if (lastRec.bettingStep < 4) {
                  bettingStep = lastRec.bettingStep + 1;
                } else {
                  bettingStep = 1; // Reset after 4 losses
                }
              } else {
                bettingStep = 1; // Reset after win
              }
            }

            newRecs.unshift({
              period: nextPeriodStr,
              basedOnPeriod: latestDraw.period,
              recommendedNumbers,
              status: 'pending',
              patternType,
              createTime: Date.now(),
              bettingStep
            });
            changed = true;
            
            // Voice notification
            if (enableVoice && 'speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(`第${nextPeriodStr.slice(-3)}期推荐已生成，倍投策略第${bettingStep}轮`);
              utterance.lang = 'zh-CN';
              window.speechSynthesis.speak(utterance);
            }
          }
        }
      }

      return changed ? newRecs : prev;
    });
  }, [draws]);

  const handleDownload = () => {
    if (recommendations.length === 0) return;
    
    // CSV Header
    const headers = ['预测期号', '推荐号码', '倍投策略', '本轮盈亏', '状态', '实际冠军', '创建时间'];
    
    // CSV Rows
    const rows = recommendations.map(rec => [
      rec.period,
      rec.recommendedNumbers.join(' '),
      `第${rec.bettingStep}轮`,
      rec.profit !== undefined ? rec.profit : '-',
      rec.status === 'won' ? '中奖' : rec.status === 'lost' ? '未中' : '等待开奖',
      rec.actualChampion || '-',
      format(rec.createTime, 'yyyy-MM-dd HH:mm:ss')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lottery_recommendations_${format(new Date(), 'yyyyMMddHHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalProfit = recommendations.reduce((sum, rec) => sum + (rec.profit || 0), 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderBallRow = (result: string | number[]) => {
    const nums = Array.isArray(result) 
      ? result.map(String) 
      : String(result).split(/[,\s]+/).filter(n => n.trim());
    
    const firstHalf = nums.slice(0, 5);
    const secondHalf = nums.slice(5);

    return (
      <div className="flex items-center">
        <div className="flex gap-1.5">
          {firstHalf.map((n, i) => (
             <div key={`f-${i}`} className={`${getNumberColor(n)} text-white w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shadow-md`}>{n}</div>
          ))}
        </div>
        <div className="w-8"></div> {/* Spacer */}
        <div className="flex gap-1.5">
          {secondHalf.map((n, i) => (
             <div key={`s-${i}`} className={`${getNumberColor(n)} text-white w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shadow-md`}>{n}</div>
          ))}
        </div>
      </div>
    );
  };

  const renderComparisonRow = (label: string, draw: DrawRecord | undefined) => {
    if (!draw) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-mono text-gray-400 uppercase">{label}</span>
          <span className="text-lg font-mono font-bold text-white">{draw.period}</span>
        </div>
        {renderBallRow(draw.result)}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-10">
        <div>
          <h1 className="text-4xl font-serif font-black uppercase tracking-tighter leading-none">
            开奖大师 <span className="text-sm font-sans font-normal normal-case tracking-normal opacity-50 ml-2">v1.0</span>
          </h1>
          <p className="text-xs font-mono mt-1 opacity-60 uppercase">实时积分开奖分析与策略</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4 border-r border-[#141414]/10 pr-4">
            <span className="text-[10px] font-mono uppercase opacity-50">最后读取</span>
            <span className="text-xs font-mono font-bold">
              {format(lastAttempt, 'HH:mm:ss')}
            </span>
          </div>
          <div className="flex flex-col items-end mr-4 border-r border-[#141414]/10 pr-4">
            <span className="text-[10px] font-mono uppercase opacity-50">最后更新</span>
            <span className="text-xs font-mono font-bold">
              {format(lastUpdated, 'HH:mm:ss')}
            </span>
          </div>
          <div className="flex flex-col items-end">
            {nextPeriod && (
              <span className="text-[10px] font-mono uppercase opacity-50">
                下期开奖: {nextPeriod}
              </span>
            )}
          </div>
          <button 
            onClick={() => setEnableVoice(!enableVoice)}
            className={`p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors ${!enableVoice ? 'opacity-50' : ''}`}
            title={enableVoice ? "关闭语音提示" : "开启语音提示"}
          >
            {enableVoice ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button 
            onClick={() => setShowRecommendations(true)}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors relative"
          >
            <List size={20} />
            {recommendations.some(r => r.status === 'pending') && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_500px] overflow-hidden">
        {/* Left Column: History */}
        <section className="border-r border-[#141414] overflow-y-auto bg-white/50">
          <div className="p-4 border-b border-[#141414] flex justify-between items-center bg-[#E4E3E0]">
            <div className="flex items-center gap-2">
              <History size={16} className="opacity-50" />
              <span className="font-serif italic text-sm uppercase font-bold">历史开奖记录</span>
            </div>
            <button 
              onClick={() => handleRefresh()}
              disabled={loading}
              className="flex items-center gap-2 text-xs font-mono uppercase hover:underline disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? '正在获取...' : '刷新数据'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-orange-100 border-b border-orange-200 flex items-center gap-2 text-[10px] text-orange-800 font-mono uppercase">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-[100px_1fr_80px] p-4 border-b border-[#141414]/10 bg-white sticky top-0 z-[5]">
            <div className="text-sm font-sans text-gray-500 text-center">期数</div>
            <div className="flex justify-center">
              <div className="bg-[#FF9933] text-white px-12 py-1 rounded-full text-sm font-sans">号码</div>
            </div>
            <div className="text-sm font-sans text-gray-500 text-center">大小</div>
          </div>

          <AnimatePresence mode="popLayout">
            {draws.map((draw, idx) => (
              <motion.div 
                key={`${draw.period}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="grid grid-cols-[100px_1fr_80px] p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center"
              >
                <div className="text-sm text-gray-600 text-center font-sans">{draw.period}</div>
                <div className="flex justify-center gap-1.5 px-4">
                  {(Array.isArray(draw.result) ? draw.result : draw.result.split(',')).map((num, nIdx) => (
                    <div 
                      key={nIdx}
                      className={`${getNumberColor(String(num).trim())} text-white w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm shadow-sm`}
                    >
                      {String(num).trim()}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${draw.bigSmall === '大' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                    {draw.bigSmall}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        {/* Right Column: Comparison Analysis */}
        <section className="flex flex-col bg-[#141414] text-[#E4E3E0]">
          <div className="p-4 border-b border-[#E4E3E0]/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <GitCompare size={18} className="text-emerald-400" />
              <span className="font-serif italic text-sm uppercase font-bold tracking-widest">历史对比分析</span>
            </div>
          </div>

          <div className="flex-1 p-8 overflow-y-auto">
            {draws.length > 0 ? (
              <div className="space-y-2">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-mono text-gray-400 uppercase">最新4期冠军号码</span>
                  </div>
                  <div className="flex gap-3">
                    {draws.slice(0, 4).map((draw, idx) => {
                      const champion = Array.isArray(draw.result) 
                        ? String(draw.result[0]) 
                        : String(draw.result).split(/[,\s]+/)[0];
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <div className={`${getNumberColor(champion)} text-white w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg shadow-md`}>
                            {champion}
                          </div>
                          <span className="text-[10px] font-mono text-gray-500">{draw.period.slice(-3)}期</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="h-px bg-[#E4E3E0]/10 my-6"></div>
                
                {draws.length > 49 ? (
                  <>
                    {renderComparisonRow("对比 - 45期", draws[45])}
                    {renderComparisonRow("对比 - 46期", draws[46])}
                    {renderComparisonRow("对比 - 47期", draws[47])}
                    {renderComparisonRow("对比 - 48期", draws[48])}
                    {renderComparisonRow("对比 - 49期", draws[49])}

                    <div className="h-px bg-[#E4E3E0]/10 my-6"></div>
                    
                    <div className="space-y-4">
                      <div className="text-sm font-mono text-gray-400 uppercase mb-2">冠军位置分析</div>
                      
                      {[
                        { championDraw: draws[3], targetDraw: draws[49], label: "第4期冠军 vs 49期" },
                        { championDraw: draws[2], targetDraw: draws[48], label: "第3期冠军 vs 48期" },
                        { championDraw: draws[1], targetDraw: draws[47], label: "第2期冠军 vs 47期" },
                        { championDraw: draws[0], targetDraw: draws[46], label: "最新冠军 vs 46期" }
                      ].map((item, idx) => {
                        const champion = Array.isArray(item.championDraw.result) 
                          ? item.championDraw.result[0] 
                          : parseInt(String(item.championDraw.result).split(/[,\s]+/)[0]);
                        
                        const targetNums = Array.isArray(item.targetDraw.result)
                          ? item.targetDraw.result
                          : String(item.targetDraw.result).split(/[,\s]+/).map(n => parseInt(n.trim()));
                        
                        const leftHalf = targetNums.slice(0, 5);
                        const rightHalf = targetNums.slice(5);
                        
                        let position = "未出现";
                        let color = "text-gray-500";
                        
                        if (leftHalf.includes(champion)) {
                          position = "左半区";
                          color = "text-yellow-400";
                        } else if (rightHalf.includes(champion)) {
                          position = "右半区";
                          color = "text-blue-400";
                        }
                        
                        return (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-400">{item.label}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] opacity-50">冠军:</span>
                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-white ${getNumberColor(String(champion))}`}>
                                  {champion}
                                </span>
                              </div>
                            </div>
                            <span className={`font-mono font-bold ${color}`}>{position}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 opacity-50">
                    <p className="font-mono text-sm">需要至少50期数据进行对比分析</p>
                    <p className="text-xs mt-2">当前数据量: {draws.length}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <p className="text-xs font-mono uppercase">等待数据加载...</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Recommendations Modal */}
      <AnimatePresence>
        {showRecommendations && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-serif font-bold italic">推荐记录</h2>
                  {recommendations.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">
                        <span className="text-xs text-gray-500">总盈亏:</span>
                        <span className={`text-sm font-bold font-mono ${totalProfit > 0 ? 'text-emerald-600' : totalProfit < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {totalProfit > 0 ? '+' : ''}{totalProfit}
                        </span>
                      </div>
                      <button 
                        onClick={handleDownload}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <Download size={14} />
                        下载记录
                      </button>
                      <button 
                        onClick={handleClearRecommendations}
                        className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                        清空记录
                      </button>
                    </>
                  )}
                </div>
                <button onClick={() => setShowRecommendations(false)}>
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {recommendations.length === 0 ? (
                  <div className="text-center py-10 opacity-50 font-mono">暂无推荐记录</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#141414] text-xs font-mono uppercase opacity-60">
                        <th className="py-2">预测期号</th>
                        <th className="py-2">推荐号码</th>
                        <th className="py-2">倍投策略</th>
                        <th className="py-2">本轮盈亏</th>
                        <th className="py-2">状态</th>
                        <th className="py-2">实际冠军</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.map((rec, idx) => (
                        <tr key={idx} className="border-b border-[#141414]/10 font-mono text-sm">
                          <td className="py-3">{rec.period}</td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              {rec.recommendedNumbers.map(n => (
                                <span key={n} className={`${getNumberColor(String(n))} text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold`}>
                                  {n}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              rec.bettingStep === 1 ? 'bg-gray-200 text-gray-700' :
                              rec.bettingStep === 2 ? 'bg-blue-100 text-blue-700' :
                              rec.bettingStep === 3 ? 'bg-purple-100 text-purple-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              第{rec.bettingStep}轮
                            </span>
                          </td>
                          <td className="py-3">
                            {rec.profit !== undefined ? (
                              <span className={`font-mono font-bold ${rec.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {rec.profit > 0 ? '+' : ''}{rec.profit}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3">
                            {rec.status === 'pending' && <span className="text-gray-500">等待开奖</span>}
                            {rec.status === 'won' && <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={14}/> 中奖</span>}
                            {rec.status === 'lost' && <span className="text-red-600 flex items-center gap-1"><XCircle size={14}/> 未中</span>}
                          </td>
                          <td className="py-3">
                            {rec.actualChampion ? (
                              <span className={`${getNumberColor(String(rec.actualChampion))} text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold`}>
                                {rec.actualChampion}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#141414]/80 backdrop-blur-sm p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-sm p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">确认清空?</h3>
              <p className="text-sm text-gray-600 mb-6">
                确定要清空所有推荐记录吗？此操作不可恢复。
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmClearRecommendations}
                  className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  确认清空
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-serif font-bold italic mb-6">软件配置</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">数据源网址 (网页抓取)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Database className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                      <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/lottery/results"
                        className="w-full bg-white border border-[#141414] pl-10 pr-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">自动更新间隔 (秒)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                      <input 
                        type="number" 
                        value={autoRefreshInterval}
                        onChange={(e) => setAutoRefreshInterval(Math.max(5, parseInt(e.target.value) || 15))}
                        className="w-full bg-white border border-[#141414] pl-10 pr-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">倒计时时长 (分钟)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                      <input 
                        type="number" 
                        value={countdownDuration}
                        onChange={(e) => setCountdownDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-[#141414] pl-10 pr-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">语音提示</label>
                  <button
                    onClick={() => setEnableVoice(!enableVoice)}
                    className={`flex items-center gap-2 px-4 py-2 border ${enableVoice ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-gray-500 border-gray-300'} transition-colors w-full`}
                  >
                    {enableVoice ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    <span className="text-xs font-mono font-bold uppercase">{enableVoice ? '已开启' : '已关闭'}</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-[#141414]/10">
                  <label className="block text-[10px] font-mono uppercase mb-2 opacity-60">手动输入数据 (可选)</label>
                  <textarea 
                    value={manualData}
                    onChange={(e) => setManualData(e.target.value)}
                    placeholder="期号,结果 (每行一条)&#10;例如: 20240101001,1 2 3"
                    className="w-full h-32 bg-white border border-[#141414] p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414] resize-none"
                  />
                  <button 
                    onClick={handleManualEntry}
                    className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-2 text-[10px] font-mono uppercase font-bold hover:bg-emerald-600 transition-colors"
                  >
                    应用手动数据
                  </button>
                </div>

                <div className="pt-4 border-t border-[#141414]/10 flex justify-end gap-4">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="text-xs font-mono uppercase hover:underline"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs font-mono uppercase font-bold hover:bg-emerald-600 transition-colors"
                  >
                    保存更改
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
