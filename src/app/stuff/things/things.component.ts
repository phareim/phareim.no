import {Component, OnInit} from '@angular/core';
import {Thing} from '../c/thing';
import {Color} from '../s/color';

@Component({
    selector: 'app-things',
    templateUrl: './things.component.html',
    styleUrls: ['./things.component.css']
})
export class ThingsComponent implements OnInit {
    things: Thing[] = [];

    constructor() {
    }

    ngOnInit() {
        console.log('all the things!!');
        const number = Math.floor(Math.random() * 70) + 30;
        this.things.push(<Thing>{title: 'Ærlig talt.', color: Color.getRandomColor()});
        this.things.push(<Thing>{title: '', icon: 'fa-twitter', color: Color.getRandomColor()});
        this.things.push(<Thing>{title: 'Work', color: Color.getRandomColor(), clickEvent: this.changeColor});
        for (let i = 1; i < number; i++) {
            this.things.push(<Thing>{title: i.toString(), color: Color.getRandomColor()});
            if (i % 7 === 0) {
                this.things[this.things.length - 1].clickEvent = this.changeColor;
            }
        }
        this.shuffle(this.things);

    }

    changeColor(t: Thing) {
        t.color = Color.getRandomColor();
    }

    shuffle(array: any[]): any[] {
        let currentIndex = array.length, temporaryValue, randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }
}
