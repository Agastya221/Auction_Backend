import fs from 'fs/promises';
import path from 'path';
import { AuctionSnapshot } from '../types';

class SnapshotManager {
  private static instance: SnapshotManager;
  private snapshotPath: string;
  
  private constructor() {
    this.snapshotPath = path.join(process.cwd(), 'snapshots');
  }
  
  public static getInstance(): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager();
    }
    return SnapshotManager.instance;
  }
  
  public async saveSnapshot(snapshot: AuctionSnapshot): Promise<void> {
    try {
      await fs.mkdir(this.snapshotPath, { recursive: true });
      const filename = `snapshot-${Date.now()}.json`;
      const filepath = path.join(this.snapshotPath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
      console.log(`✅ Snapshot saved: ${filename}`);
      
      // Keep only last 5 snapshots
      await this.cleanupOldSnapshots();
    } catch (error) {
      console.error('❌ Failed to save snapshot:', error);
    }
  }
  
  public async loadLatestSnapshot(): Promise<AuctionSnapshot | null> {
    try {
      const files = await fs.readdir(this.snapshotPath);
      const snapshotFiles = files
        .filter(file => file.startsWith('snapshot-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (snapshotFiles.length === 0) {
        return null;
      }
      
      const latestFile = path.join(this.snapshotPath, snapshotFiles[0]);
      const data = await fs.readFile(latestFile, 'utf-8');
      
      console.log(`✅ Loaded snapshot: ${snapshotFiles[0]}`);
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Failed to load snapshot:', error);
      return null;
    }
  }
  
  private async cleanupOldSnapshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.snapshotPath);
      const snapshotFiles = files
        .filter(file => file.startsWith('snapshot-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      // Keep only the 5 most recent snapshots
      for (let i = 5; i < snapshotFiles.length; i++) {
        await fs.unlink(path.join(this.snapshotPath, snapshotFiles[i]));
      }
    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error);
    }
  }
}

export default SnapshotManager;