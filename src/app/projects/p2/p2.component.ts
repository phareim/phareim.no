import {Component, OnInit} from '@angular/core';
import {Message} from '../c/message';

@Component({
    selector: 'app-p2',
    templateUrl: './p2.component.html',
    styleUrls: ['./p2.component.css']
})
export class P2Component implements OnInit {
    message: string;
    conversation: Message[];

    constructor() {
    }

    ngOnInit() {
        this.message = '';
        this.conversation = [];
    }

    addMessage() {
        if (this.message.length > 0) {
            this.conversation.push({text: this.message, sender: 'stranger'});
            this.message = '';
        }
    }
}
