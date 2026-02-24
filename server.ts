import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to fetch draw records from a URL
  app.post("/api/fetch-draws", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const drawsMap = new Map<string, any>();
      let nextDrawTime: string | null = null;
      let secondsLeft: number | null = null;
      let nextPeriod: string | null = null;
      
      const addDraw = (draw: any) => {
        if (draw.period && !drawsMap.has(draw.period)) {
          drawsMap.set(draw.period, draw);
        }
      };
      
      // 1. Primary Source: Try the specific API first
      const apiUrls = [
        'https://api.api68.com/pks/getLotteryPksInfo.do?lotCode=10012',
        'https://api.api86.com/pks/getLotteryPksInfo.do?lotCode=10012'
      ];

      for (const apiUrl of apiUrls) {
        try {
          const apiRes = await axios.get(apiUrl, { 
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          
          if (apiUrl.includes('api68.com') || apiUrl.includes('api86.com')) {
            const data = apiRes.data?.result?.data;
            if (Array.isArray(data)) {
              data.forEach((r: any) => {
                const period = r.preDrawIssue;
                const resText = r.preDrawCode;
                if (period && resText) {
                  const numbers = String(resText).split(/[\s,]+/).filter(n => n.length > 0);
                  const sum = numbers.slice(0, 3).reduce((a, b) => a + (parseInt(b) || 0), 0);
                  addDraw({
                    period: String(period),
                    result: numbers.join(', '),
                    sum,
                    bigSmall: sum >= 14 ? '大' : '小',
                    oddEven: sum % 2 === 0 ? '双' : '单'
                  });
                }
              });
              // Extract next draw time if available
              if (data[0]?.drawTime) {
                nextDrawTime = data[0].drawTime;
              }
            }
          } else if (apiRes.data && Array.isArray(apiRes.data)) {
            apiRes.data.forEach((r: any) => {
              const period = r.period || r.draw_number || r.id;
              const resText = r.result || r.numbers;
              if (period && resText) {
                const numbers = String(resText).split(/[\s,]+/).filter(n => n.length > 0);
                const sum = numbers.reduce((a, b) => a + (parseInt(b) || 0), 0);
                addDraw({
                  period: String(period),
                  result: numbers.join(', '),
                  sum,
                  bigSmall: sum >= 14 ? '大' : '小',
                  oddEven: sum % 2 === 0 ? '双' : '单'
                });
              }
            });
          }
          if (drawsMap.size > 0) break;
        } catch (e) {
          console.error(`API fetch failed for ${apiUrl}:`, e.message);
        }
      }

      // 2. Secondary Source: Scraping if API failed
      if (drawsMap.size === 0 || !nextDrawTime) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 10000
          });

          const $ = cheerio.load(response.data);

          // Try to find countdown or next draw time in text
          const pageText = $.text();
          
          // Pattern 1: "Next Draw: 21301196" followed by a timer "00:20"
          const nextDrawWithTimer = pageText.match(/(?:Next Draw|下期开奖).*?(\d{6,})[\s\S]*?(\d{1,2}):(\d{2})/i);
          if (nextDrawWithTimer) {
            nextPeriod = nextDrawWithTimer[1];
            const mins = parseInt(nextDrawWithTimer[2]);
            const secs = parseInt(nextDrawWithTimer[3]);
            if (mins < 6) { // Usually countdowns are short for 5-min games
              secondsLeft = mins * 60 + secs;
            }
          }

          // Pattern 2: "00:20" or "4:59" (Generic)
          const countdownMatch = pageText.match(/(\d{1,2}):(\d{2})/);
          // Pattern 3: "4分59秒"
          const countdownMatchCN = pageText.match(/(\d{1,2})\s*分\s*(\d{1,2})\s*秒/i);
          // Pattern 4: "Next Draw: 21301196" (Just period)
          const nextDrawPeriodMatch = pageText.match(/(?:Next Draw|下期开奖).*?(\d{6,})/i);
          // Pattern 5: "Next Draw: 15:55" (Just time)
          const nextDrawTimeMatch = pageText.match(/(?:Next|下期).*?(\d{1,2}:\d{2})/i);

          if (!secondsLeft) {
            if (countdownMatch) {
              const mins = parseInt(countdownMatch[1]);
              const secs = parseInt(countdownMatch[2]);
              if (mins < 6) { // Every 5 mins, so countdown should be < 5 or 6
                secondsLeft = mins * 60 + secs;
              } else if (!nextDrawTime) {
                nextDrawTime = countdownMatch[0];
              }
            } else if (countdownMatchCN) {
              secondsLeft = parseInt(countdownMatchCN[1]) * 60 + parseInt(countdownMatchCN[2]);
            }
          }

          if (nextDrawTimeMatch && !nextDrawTime) {
            nextDrawTime = nextDrawTimeMatch[1];
          }

          if (nextDrawPeriodMatch && !nextPeriod) {
            nextPeriod = nextDrawPeriodMatch[1];
          }
          
          // Look for specific countdown elements by ID or class
          const countdownEl = $('#countdown, .countdown, #timer, .timer, .draw-timer, .next-draw-timer, [class*="timer"], [id*="timer"], [class*="countdown"], [id*="countdown"]').first();
          if (countdownEl.length) {
            const timerText = countdownEl.text().trim();
            const m = timerText.match(/(\d{1,2}):(\d{2})/);
            if (m) {
              const mins = parseInt(m[1]);
              const secs = parseInt(m[2]);
              if (mins < 6) { // Strictly for 5-min games
                secondsLeft = mins * 60 + secs;
              }
            }
          }
          
          // Specific scraper for auluckylottery.com
          if (url.includes('auluckylottery.com')) {
            $('.past-results-item, .result-item, .draw-item').each((_, el) => {
              const text = $(el).text();
              const drawMatch = text.match(/Draw:\s*(\d+)/i);
              
              const balls: string[] = [];
              $(el).find('.ball, .number, [class*="ball-"]').each((_, ball) => {
                const num = $(ball).text().trim();
                if (num && !isNaN(parseInt(num))) balls.push(num);
              });

              if (drawMatch && balls.length >= 10) {
                const period = drawMatch[1];
                const numbers = balls.slice(0, 10);
                const sum = numbers.slice(0, 3).reduce((a, b) => a + (parseInt(b) || 0), 0);
                addDraw({
                  period,
                  result: numbers.join(', '),
                  sum,
                  bigSmall: sum >= 14 ? '大' : '小',
                  oddEven: sum % 2 === 0 ? '双' : '单'
                });
              }
            });

            // Fallback if specific classes not found - look for any container with "Draw:" and 10 numbers
            if (drawsMap.size === 0) {
              $('div, section, li').each((_, el) => {
                const html = $(el).html() || "";
                const text = $(el).text();
                if (text.includes('Draw:') && text.match(/\d{5,}/)) {
                  const drawMatch = text.match(/Draw:\s*(\d+)/i);
                  const balls: string[] = [];
                  // Look for numbers inside spans or divs that look like balls
                  $(el).find('span, div').each((_, sub) => {
                    const val = $(sub).text().trim();
                    if (val && /^\d{1,2}$/.test(val)) balls.push(val);
                  });

                  if (drawMatch && balls.length >= 10) {
                    const period = drawMatch[1];
                    const numbers = balls.slice(0, 10);
                    const sum = numbers.slice(0, 3).reduce((a, b) => a + (parseInt(b) || 0), 0);
                    addDraw({
                      period,
                      result: numbers.join(', '),
                      sum,
                      bigSmall: sum >= 14 ? '大' : '小',
                      oddEven: sum % 2 === 0 ? '双' : '单'
                    });
                  }
                }
              });
            }
          }

          // Try to find JSON data in script tags (Generic Fallback)
          if (drawsMap.size === 0) {
            $('script').each((_, script) => {
              const content = $(script).html() || "";
              if (content.includes('results') || content.includes('draws') || content.includes('data')) {
                try {
                  const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/);
                  if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(data)) {
                      data.forEach((r: any) => {
                        const period = r.period || r.draw_number || r.id || r.issue;
                        const resText = r.result || r.numbers || r.draw_result || r.code;
                        if (period && resText) {
                          const numbers = String(resText).split(/[\s,]+/).filter(n => n.length > 0);
                          const sum = numbers.reduce((a, b) => a + (parseInt(b) || 0), 0);
                          addDraw({
                            period: String(period),
                            result: numbers.join(', '),
                            sum,
                            bigSmall: sum >= 14 ? '大' : '小',
                            oddEven: sum % 2 === 0 ? '双' : '单'
                          });
                        }
                      });
                    }
                  }
                } catch (e) {}
              }
            });
          }

          // Table scraping fallback
          if (drawsMap.size === 0) {
            $('tr').each((_, row) => {
              const cells = $(row).find('td');
              if (cells.length >= 2) {
                const period = $(cells[0]).text().trim();
                const resultText = $(cells[1]).text().trim();

                if (period && resultText && /^\d+/.test(period)) {
                  const numbers = resultText.split(/[\s,]+/).filter(n => n.length > 0);
                  if (numbers.length > 0) {
                    const sum = numbers.reduce((a, b) => a + (parseInt(b) || 0), 0);
                    addDraw({
                      period,
                      result: numbers.join(', '),
                      sum,
                      bigSmall: sum >= 14 ? '大' : '小',
                      oddEven: sum % 2 === 0 ? '双' : '单'
                    });
                  }
                }
              }
            });
          }
        } catch (e) {
          console.error(`Scraping failed for ${url}:`, e.message);
        }
      }

      // 3. Aggressive fallback: Look for any text patterns
      if (drawsMap.size === 0) {
        try {
          const response = await axios.get(url).catch(() => null);
          if (response) {
            const $ = cheerio.load(response.data);
            const text = $.text();
            const lines = text.split('\n');
            lines.forEach(line => {
              const matches = line.match(/(\d{6,})\s+((?:\d{1,2}\s+){9}\d{1,2})/);
              if (matches) {
                const period = matches[1];
                const numbers = matches[2].split(/\s+/);
                const sum = numbers.slice(0, 3).reduce((a, b) => a + (parseInt(b) || 0), 0);
                addDraw({
                  period,
                  result: numbers.join(', '),
                  sum,
                  bigSmall: sum >= 14 ? '大' : '小',
                  oddEven: sum % 2 === 0 ? '双' : '单'
                });
              }
            });
          }
        } catch (e) {
          console.error("Aggressive fallback failed:", e.message);
        }
      }

      const finalDraws = Array.from(drawsMap.values())
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, 50);

      res.json({ 
        draws: finalDraws,
        nextDrawTime,
        secondsLeft,
        nextPeriod
      });
    } catch (error: any) {
      console.error("Fetch error:", error.message);
      res.status(500).json({ error: "Failed to fetch data from URL", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
