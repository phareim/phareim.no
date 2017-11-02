import {Thing} from '../c/thing';

export class Color {
    static getRandomColor(): string {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    static getRandomGreyColor(): string {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 1; i++) {
            const number = Math.floor(Math.random() * 16);
            const number2 = Math.floor(Math.random() * 16);

            color +=
                letters[(number < 2 ? 0 : number - 1)] + letters[(number2 > 13 ? 15 : number + 1)] +
                letters[(number > 13 ? 15 : number + 1)] + letters[(number2 > 13 ? 15 : number + 1)] +
                letters[(number > 13 ? 15 : number + 2)] + letters[(number2 > 13 ? 15 : number + 3)];
        }
        return color;
    }

    static randomize(t: Thing) {
        t.color = Color.getRandomColor();
    }
}
