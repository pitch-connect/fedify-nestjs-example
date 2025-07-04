import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Actor } from '../../../entities';
import { ActorSyncService } from '../services/actor-sync.service';

@Injectable()
export class ActorHandler {
  private Person: any;
  private Application: any;
  private Image: any;
  private CryptographicKey: any;
  private Endpoints: any;

  private fedifyInitialized = false;
  private importSpki: any;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Actor)
    private actorRepository: Repository<Actor>,
    private actorSyncService: ActorSyncService,
  ) {}

  private async initializeFedifyClasses() {
    if (this.fedifyInitialized) return;

    const importDynamic = new Function('specifier', 'return import(specifier)');
    const fedifyModule = await importDynamic('@fedify/fedify');
    this.Person = fedifyModule.Person;
    this.Application = fedifyModule.Application;
    this.Image = fedifyModule.Image;
    this.CryptographicKey = fedifyModule.CryptographicKey;
    this.Endpoints = fedifyModule.Endpoints;
    this.importSpki = fedifyModule.importSpki;
    this.fedifyInitialized = true;
  }

  async handleActor(ctx: any, handle: string) {
    console.log('ActorHandler.handleActor called with handle:', handle);
    console.log('Context type:', typeof ctx);
    console.log('Context keys:', Object.keys(ctx));
    console.log('Context has getActorUri?', typeof ctx.getActorUri);

    const user = await this.userRepository.findOne({
      where: { username: handle },
    });
    if (!user) {
      console.log('User not found for handle:', handle);
      return null;
    }

    // Ensure Fedify classes are loaded
    await this.initializeFedifyClasses();

    // Ensure actor entity exists and is synced
    const actor = await this.actorSyncService.syncUserToActor(user);

    // Create Fedify actor data using context methods for proper URI generation
    const actorData: any = {
      id: ctx.getActorUri(handle),
      preferredUsername: actor.preferredUsername,
      name: actor.name,
      summary: actor.summary,
      url: ctx.getActorUri(handle),
      inbox: ctx.getInboxUri(handle),
      outbox: ctx.getOutboxUri(handle),
      followers: ctx.getFollowersUri(handle),
      following: ctx.getFollowingUri(handle),
      manuallyApprovesFollowers: actor.manuallyApprovesFollowers,
    };

    // Add optional icon if available
    if (actor.icon) {
      actorData.icon = new this.Image({
        url: new URL(actor.icon.url),
        mediaType: actor.icon.mediaType,
      });
    }

    // Return the appropriate Fedify Actor type
    let result;
    if (actor.type === 'Person') {
      result = new this.Person(actorData);
    } else if (actor.type === 'Application' || actor.type === 'Service') {
      result = new this.Application(actorData);
    } else {
      // Default to Person if type is unknown
      result = new this.Person(actorData);
    }

    console.log('Returning actor:', result);
    return result;
  }

  async handleFollowers(ctx: any, actorId: string) {
    // TODO: Implement followers collection
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${actorId}/followers`,
      totalItems: 0,
      orderedItems: [],
    };
  }

  async handleFollowing(ctx: any, actorId: string) {
    // TODO: Implement following collection
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${actorId}/following`,
      totalItems: 0,
      orderedItems: [],
    };
  }
}
