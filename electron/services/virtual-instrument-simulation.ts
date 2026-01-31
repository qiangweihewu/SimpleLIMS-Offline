
import { serialService } from './serial-service.js';
import { CTRL, calculateChecksum } from './astm-parser.js';
import { VirtualPort } from './virtual-port.js';

/**
 * Service to simulate instrument behavior for testing/development
 */
class VirtualInstrumentSimulation {
    private activeSimulations: Map<string, boolean> = new Map();

    /**
     * Start simulating a Mindray BC-3000 Plus on the virtual port
     */
    async startBC3000Simulation(path: string = 'VIRTUAL:BC-3000') {
        const port = serialService.getVirtualPort(path);
        if (!port) {
            console.error(`Virtual port ${path} not found. Connect to it first.`);
            return;
        }

        if (this.activeSimulations.get(path)) {
            console.log(`Simulation already active for ${path}`);
            return;
        }
        this.activeSimulations.set(path, true);

        console.log(`[Simulator] Starting BC-3000 simulation on ${path}`);

        // Listen for data from the host (ACKs, NAKs, etc.)
        port.on('dataOnPort', (data: Buffer) => {
            const hex = data.toString('hex').toUpperCase();
            console.log(`[Simulator] Received from host: ${hex}`);
        });

        // Simulate a random interval of results
        setInterval(async () => {
            if (!this.activeSimulations.get(path)) return;
            if (!port.isOpen) return;

            await this.transmitResult(port);
        }, 30000); // Every 30 seconds
    }

    stopSimulation(path: string) {
        this.activeSimulations.set(path, false);
    }

    /**
     * Transmit a full ASTM result sequence
     */
    private async transmitResult(port: VirtualPort) {
        console.log('[Simulator] Initiating transmission...');

        try {
            // 1. Send ENQ
            await this.send(port, Buffer.from([CTRL.ENQ]));

            // 2. Wait for ACK (simplification: just wait a bit, real sim should wait for event)
            await this.wait(500);

            // 3. Send Header
            // <STX>1H|\^&|||Mindray^BC-3000Plus||||||||E1394-97<CR><ETX>CS<CR><LF>
            await this.sendFrame(port, 1, 'H|\\^&|||Mindray^BC-3000Plus||||||||E1394-97');
            await this.wait(200);

            // 4. Send Patient
            await this.sendFrame(port, 2, 'P|1');
            await this.wait(200);

            // 5. Send Order
            await this.sendFrame(port, 3, 'O|1|Sample001||^^^WBC^1\^^^RBC^2||||||||||||||||||||F');
            await this.wait(200);

            // 6. Send Results
            const wbc = (4.0 + Math.random() * 6.0).toFixed(1); // 4.0 - 10.0
            const rbc = (3.5 + Math.random() * 2.0).toFixed(2); // 3.5 - 5.5

            await this.sendFrame(port, 4, `R|1|^^^WBC^1|${wbc}|10*9/L||N||F||||20231025100000`);
            await this.wait(200);

            await this.sendFrame(port, 5, `R|2|^^^RBC^2|${rbc}|10*12/L||N||F||||20231025100000`);
            await this.wait(200);

            // 7. Send Terminator
            await this.sendFrame(port, 6, 'L|1|N');
            await this.wait(200);

            // 8. Send EOT
            await this.send(port, Buffer.from([CTRL.EOT]));
            console.log('[Simulator] Transmission complete.');

        } catch (err) {
            console.error('[Simulator] Transmission failed', err);
        }
    }

    private async sendFrame(port: VirtualPort, seq: number, content: string) {
        // Frame: STX + Seq + Content + ETX + Checksum + CR + LF
        const seqChar = (seq % 8).toString();
        const rawBody = seqChar + content + String.fromCharCode(CTRL.ETX);
        const checksum = calculateChecksum(Buffer.from(rawBody), 0, rawBody.length - 1);

        const frame = String.fromCharCode(CTRL.STX) + rawBody + checksum + String.fromCharCode(CTRL.CR) + String.fromCharCode(CTRL.LF);

        await this.send(port, Buffer.from(frame));
    }

    private send(port: VirtualPort, data: Buffer): Promise<void> {
        port.simulateReceive(data);
        return Promise.resolve();
    }

    private wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const virtualInstrumentSimulation = new VirtualInstrumentSimulation();
