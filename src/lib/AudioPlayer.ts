import { base64ToPcm } from './audio';

export class AudioPlayer {
  public ctx: AudioContext;
  private nextStartTime: number = 0;
  
  constructor(sampleRate: number = 24000) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ sampleRate });
    this.nextStartTime = this.ctx.currentTime;
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('Could not resume AudioPlayer context', e);
      }
    }
  }
  
  playChunk(base64Data: string) {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.warn);
    }
    const pcm = base64ToPcm(base64Data);
    const audioBuffer = this.ctx.createBuffer(1, pcm.length, this.ctx.sampleRate);
    audioBuffer.getChannelData(0).set(pcm);
    
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);
    
    if (this.nextStartTime < this.ctx.currentTime) {
      this.nextStartTime = this.ctx.currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }
  
  stop() {
    try {
      this.ctx.close();
    } catch (e) {}
  }
  
  clearQueue() {
    this.nextStartTime = this.ctx.currentTime;
  }
}
