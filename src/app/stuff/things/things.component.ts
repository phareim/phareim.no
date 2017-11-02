import {Component, OnInit} from '@angular/core';
import {Thing} from '../c/thing';
import {Color} from '../s/color';
import {Utils} from '../s/utils';

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
        this.things.push(<Thing>{title: 'Work', color: Color.getRandomColor()});
        for (let i = 1; i < number; i++) {
            this.things.push(<Thing>{title: i.toString(), color: Color.getRandomGreyColor()});
            if (i % 7 === 0) {
                this.things[this.things.length - 1].clickEvent = Color.randomize(this.things[this.things.length - 1]);
            }
        }
        Utils.shuffle(this.things);
    }

    delete(thing: Thing, really?: boolean) {
        if (really) {
            const number = this.things.indexOf(thing);
            this.things.splice(number, 1);
        }
    }
}
